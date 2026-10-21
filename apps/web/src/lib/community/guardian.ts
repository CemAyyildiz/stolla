import { Buffer } from "buffer";
import { contract } from "@stellar/stellar-sdk";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import { requireRpcConfig } from "@/lib/stellar";

export type GuardianState = {
  paused: boolean;
  guardian: string | null;
  canPause: boolean;
  canUnpause: boolean;
  canCancel: boolean;
};

export type GuardianAction =
  | { kind: "pause"; durationLedgers: number; reasonHash: string }
  | { kind: "unpause" }
  | { kind: "cancel"; actionId: string; reasonHash: string };

export type GuardianAdapter = {
  read: (timelockId: string) => Promise<GuardianState | null>;
  submit: (
    timelockId: string,
    address: string,
    signTransaction: SignTransaction,
    action: GuardianAction,
  ) => Promise<void>;
};

type DynamicMethod = (args?: Record<string, unknown>) => Promise<{
  result: unknown;
  signAndSend: () => Promise<unknown>;
}>;

function inputs(client: contract.Client, name: string): string[] | null {
  try {
    return client.spec.getFunc(name).inputs().map((input) => input.name().toString());
  } catch {
    return null;
  }
}

function hasInputs(client: contract.Client, name: string, required: string[]): boolean {
  const actual = inputs(client, name);
  return actual !== null &&
    actual.length >= required.length &&
    actual.length <= required.length + 1 &&
    required.every((field) => actual.includes(field)) &&
    actual.every((field) => required.includes(field) || field === "guardian");
}

function method(client: contract.Client, name: string): DynamicMethod {
  return (client as unknown as Record<string, DynamicMethod>)[name];
}

function bytes32(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Enter a 64-character hexadecimal hash.");
  }
  return Buffer.from(hex, "hex");
}

async function clientFor(timelockId: string, address?: string, signTransaction?: SignTransaction) {
  const rpc = requireRpcConfig();
  return contract.Client.from({
    contractId: timelockId,
    rpcUrl: rpc.rpcUrl,
    networkPassphrase: rpc.networkPassphrase,
    publicKey: address,
    signTransaction,
  });
}

function cancelMethod(client: contract.Client): string | null {
  if (hasInputs(client, "cancel_queued_action", ["action_id", "reason_hash"])) {
    return "cancel_queued_action";
  }
  if (hasInputs(client, "cancel", ["action_id", "reason_hash"])) return "cancel";
  return null;
}

function unpauseMethod(client: contract.Client): string | null {
  if (hasInputs(client, "unpause", [])) return "unpause";
  if (hasInputs(client, "clear_pause", [])) return "clear_pause";
  return null;
}

async function readGuardian(client: contract.Client): Promise<string | null> {
  const name = hasInputs(client, "guardian", [])
    ? "guardian"
    : hasInputs(client, "get_guardian", [])
      ? "get_guardian"
      : null;
  if (!name) return null;
  const address = (await method(client, name)()).result;
  return typeof address === "string" && /^[GC][A-Z2-7]{55}$/.test(address)
    ? address
    : null;
}

export const guardianAdapter: GuardianAdapter = {
  async read(timelockId) {
    const client = await clientFor(timelockId);
    if (!hasInputs(client, "is_paused", [])) return null;
    const paused = (await method(client, "is_paused")()).result;
    if (typeof paused !== "boolean") throw new Error("Invalid pause state.");

    // A failed Guardian read never grants controls. Pause state remains visible.
    let guardian: string | null = null;
    try {
      guardian = await readGuardian(client);
    } catch {
      // The contract may expose pause state without exposing Guardian authority.
    }
    return {
      paused,
      guardian,
      canPause: guardian !== null && hasInputs(client, "pause", ["duration_ledgers", "reason_hash"]),
      canUnpause: guardian !== null && unpauseMethod(client) !== null,
      canCancel: guardian !== null && cancelMethod(client) !== null,
    };
  },

  async submit(timelockId, address, signTransaction, action) {
    const client = await clientFor(timelockId, address, signTransaction);
    const guardian = await readGuardian(client);
    if (!guardian || guardian !== address) {
      throw new Error("Only the configured Guardian wallet can submit this action.");
    }

    let name: string;
    let args: Record<string, unknown>;
    if (action.kind === "pause") {
      if (!hasInputs(client, "pause", ["duration_ledgers", "reason_hash"])) {
        throw new Error("Pause is not supported by this Timelock.");
      }
      if (!Number.isSafeInteger(action.durationLedgers) || action.durationLedgers < 1 || action.durationLedgers > 0xffffffff) {
        throw new Error("Enter a valid pause duration in ledgers.");
      }
      name = "pause";
      args = { duration_ledgers: action.durationLedgers, reason_hash: bytes32(action.reasonHash) };
    } else if (action.kind === "unpause") {
      const supported = unpauseMethod(client);
      if (!supported) throw new Error("Unpause is not supported by this Timelock.");
      name = supported;
      args = {};
    } else {
      const supported = cancelMethod(client);
      if (!supported) throw new Error("Queued action cancellation is not supported by this Timelock.");
      name = supported;
      args = { action_id: bytes32(action.actionId), reason_hash: bytes32(action.reasonHash) };
    }
    if (inputs(client, name)?.includes("guardian")) args.guardian = address;
    const transaction = await method(client, name)(args);
    await transaction.signAndSend();
  },
};
