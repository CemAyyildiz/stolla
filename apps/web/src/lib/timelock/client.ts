import { Buffer } from "buffer";
import { nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { mapTransactionError } from "@/lib/transactionErrors";
import { requireRpcConfig } from "@/lib/stellar";
import type { TimelockActionName } from "./proposalExecution";

export const TIMELOCK_CONTRACT_ID_ENV = "NEXT_PUBLIC_TIMELOCK_CONTRACT_ID";

export type TimelockCallKind =
  | "not_configured"
  | "wallet_rejected"
  | "simulation_failed"
  | "still_pending"
  | "send_failed";

export type TimelockCallResult =
  | { ok: true; transactionHash: string | null }
  | { ok: false; kind: TimelockCallKind; message: string };

export type TimelockInvocation = {
  contractId: string;
  method: TimelockActionName | "get_operation";
  publicKey: string | undefined;
  args: xdr.ScVal[];
};

export type TimelockPreparedCall = {
  result: unknown;
  signAndSend: (
    signTransaction: SignTransaction,
  ) => Promise<{ transactionHash: string | null }>;
};

/** Wallet and RPC boundary. Tests substitute this instead of the network. */
export type TimelockRpc = {
  prepare(invocation: TimelockInvocation): Promise<TimelockPreparedCall>;
  latestLedger(): Promise<number>;
};

export type TimelockOperation = {
  etaLedger: number;
  expiresAtLedger: number;
};

export type TimelockWindow = {
  etaLedger: number | null;
  expiresAtLedger: number | null;
  currentLedger: number | null;
};

type CapabilityEnvironment = Record<string, string | undefined>;

export function readTimelockContractId(
  environment: CapabilityEnvironment = process.env,
): string | null {
  const value = environment[TIMELOCK_CONTRACT_ID_ENV]?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export function buildTimelockInvocation(input: {
  contractId: string;
  method: TimelockInvocation["method"];
  proposalIdHex: string;
  publicKey?: string;
}): TimelockInvocation {
  const contractId = input.contractId.trim();
  if (!contractId) {
    throw new Error("Timelock contract id is not configured.");
  }
  const proposalIdHex = input.proposalIdHex.trim().replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(proposalIdHex) || proposalIdHex.length % 2 !== 0) {
    throw new Error("Proposal id must be an even-length hex string.");
  }
  return {
    contractId,
    method: input.method,
    publicKey: input.publicKey,
    args: [nativeToScVal(Buffer.from(proposalIdHex, "hex"))],
  };
}

function extractTransactionHash(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    hash?: unknown;
    sendTransactionResponse?: { hash?: unknown };
  };
  if (typeof record.hash === "string") return record.hash;
  const nested = record.sendTransactionResponse?.hash;
  return typeof nested === "string" ? nested : null;
}

function isWalletRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "UserRejectedError"
  );
}

function failureFromError(error: unknown): TimelockCallResult {
  if (isWalletRejection(error)) {
    return {
      ok: false,
      kind: "wallet_rejected",
      message: mapTransactionError(error).message,
    };
  }
  const mapped = mapTransactionError(error);
  if (mapped.category === "wallet_rejected") {
    return { ok: false, kind: "wallet_rejected", message: mapped.message };
  }
  if (mapped.category === "simulation_failed") {
    return { ok: false, kind: "simulation_failed", message: mapped.message };
  }
  if (mapped.category === "still_pending" || mapped.category === "confirmation_timeout") {
    return { ok: false, kind: "still_pending", message: mapped.message };
  }
  return { ok: false, kind: "send_failed", message: mapped.message };
}

export function createDefaultTimelockRpc(): TimelockRpc {
  const rpc = requireRpcConfig();
  return {
    async prepare(invocation) {
      const transaction = await AssembledTransaction.build<unknown>({
        contractId: invocation.contractId,
        method: invocation.method,
        args: invocation.args,
        networkPassphrase: rpc.networkPassphrase,
        rpcUrl: rpc.rpcUrl,
        publicKey: invocation.publicKey,
        parseResultXdr: (value) => scValToNative(value),
      });
      return {
        result: transaction.result,
        async signAndSend(signTransaction) {
          await transaction.sign({ signTransaction });
          const sent = await transaction.send();
          return { transactionHash: extractTransactionHash(sent) };
        },
      };
    },
    async latestLedger() {
      const latest = await new RpcServer(rpc.rpcUrl).getLatestLedger();
      return latest.sequence;
    },
  };
}

export async function submitTimelockAction(input: {
  action: TimelockActionName;
  contractId: string | null;
  proposalIdHex: string;
  publicKey: string;
  signTransaction: SignTransaction;
  rpc?: TimelockRpc;
}): Promise<TimelockCallResult> {
  if (!input.contractId) {
    return {
      ok: false,
      kind: "not_configured",
      message: "Timelock contract id is not configured.",
    };
  }

  let invocation: TimelockInvocation;
  try {
    invocation = buildTimelockInvocation({
      contractId: input.contractId,
      method: input.action,
      proposalIdHex: input.proposalIdHex,
      publicKey: input.publicKey,
    });
  } catch (error: unknown) {
    return failureFromError(error);
  }

  try {
    const rpc = input.rpc ?? createDefaultTimelockRpc();
    const prepared = await rpc.prepare(invocation);
    const sent = await prepared.signAndSend(input.signTransaction);
    return { ok: true, transactionHash: sent.transactionHash };
  } catch (error: unknown) {
    return failureFromError(error);
  }
}

function readLedger(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
      return value;
    }
    if (typeof value === "bigint" && value >= BigInt(0) && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
  }
  return null;
}

export function parseTimelockOperation(value: unknown): TimelockOperation | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const etaLedger = readLedger(record, ["etaLedger", "eta", "eta_ledger"]);
  const expiresAtLedger = readLedger(record, [
    "expiresAtLedger",
    "expires_at",
    "expiresAt",
    "expiry",
  ]);
  if (etaLedger === null || expiresAtLedger === null) return null;
  return { etaLedger, expiresAtLedger };
}

export async function readTimelockWindow(input: {
  contractId: string;
  proposalIdHex: string;
  publicKey?: string;
  rpc?: TimelockRpc;
}): Promise<TimelockWindow> {
  const rpc = input.rpc ?? createDefaultTimelockRpc();
  const invocation = buildTimelockInvocation({
    contractId: input.contractId,
    method: "get_operation",
    proposalIdHex: input.proposalIdHex,
    publicKey: input.publicKey,
  });
  const [prepared, currentLedger] = await Promise.all([
    rpc.prepare(invocation),
    rpc.latestLedger(),
  ]);
  const operation = parseTimelockOperation(prepared.result);
  return {
    etaLedger: operation?.etaLedger ?? null,
    expiresAtLedger: operation?.expiresAtLedger ?? null,
    currentLedger: Number.isSafeInteger(currentLedger) ? currentLedger : null,
  };
}
