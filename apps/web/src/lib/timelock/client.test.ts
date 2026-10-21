import { describe, expect, it, vi } from "vitest";
import type { SignTransaction } from "@stellar/stellar-sdk/contract";
import {
  buildTimelockInvocation,
  parseTimelockOperation,
  readTimelockContractId,
  readTimelockWindow,
  submitTimelockAction,
  type TimelockRpc,
} from "./client";

const CONTRACT = "CTIMELOCK0000000000000000000000000000000000000000000000001";
const PROPOSAL = "ab".repeat(16);

function rpc(prepare: TimelockRpc["prepare"]): TimelockRpc {
  return { prepare, latestLedger: vi.fn(async () => 40) };
}

describe("timelock client", () => {
  it("treats a missing contract id as unconfigured and does not call RPC", () => {
    expect(readTimelockContractId({})).toBeNull();
    expect(
      readTimelockContractId({ NEXT_PUBLIC_TIMELOCK_CONTRACT_ID: "  " }),
    ).toBeNull();
    expect(
      readTimelockContractId({ NEXT_PUBLIC_TIMELOCK_CONTRACT_ID: " CABC " }),
    ).toBe("CABC");
  });

  it("does not touch the wallet or RPC when no timelock id is configured", async () => {
    const prepare = vi.fn();
    const signTransaction = vi.fn() as unknown as SignTransaction;
    const result = await submitTimelockAction({
      action: "queue",
      contractId: null,
      proposalIdHex: PROPOSAL,
      publicKey: "GABC",
      signTransaction,
      rpc: rpc(prepare),
    });

    expect(result).toMatchObject({ ok: false, kind: "not_configured" });
    expect(prepare).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("submits queue, execute, and cancel through a mocked wallet and RPC", async () => {
    const methods: string[] = [];
    const signTransaction = vi.fn(async () => ({
      signedTxXdr: "signed",
      signerAddress: "GABC",
    })) as unknown as SignTransaction;
    const prepare = vi.fn(async (invocation) => {
      methods.push(invocation.method);
      return {
        result: null,
        signAndSend: async (sign: SignTransaction) => {
          await sign("xdr", { networkPassphrase: "Test SDF Network ; September 2015" });
          return { transactionHash: `${invocation.method}-hash` };
        },
      };
    });

    for (const action of ["queue", "execute", "cancel"] as const) {
      const result = await submitTimelockAction({
        action,
        contractId: CONTRACT,
        proposalIdHex: PROPOSAL,
        publicKey: "GABC",
        signTransaction,
        rpc: rpc(prepare),
      });
      expect(result).toEqual({ ok: true, transactionHash: `${action}-hash` });
    }

    expect(methods).toEqual(["queue", "execute", "cancel"]);
    expect(signTransaction).toHaveBeenCalledTimes(3);
    const invocation = buildTimelockInvocation({
      contractId: CONTRACT,
      method: "queue",
      proposalIdHex: PROPOSAL,
      publicKey: "GABC",
    });
    expect(invocation.args).toHaveLength(1);
    expect(invocation.method).toBe("queue");
  });

  it("returns a wallet rejection without reporting success", async () => {
    const prepare = vi.fn(async () => ({
      result: null,
      signAndSend: async (sign: SignTransaction) => {
        await sign("xdr", { networkPassphrase: "Test SDF Network ; September 2015" });
        return { transactionHash: "should-not-succeed" };
      },
    }));
    const result = await submitTimelockAction({
      action: "execute",
      contractId: CONTRACT,
      proposalIdHex: PROPOSAL,
      publicKey: "GABC",
      signTransaction: (async () => {
        throw new Error("User rejected the request.");
      }) as SignTransaction,
      rpc: rpc(prepare),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("wallet_rejected");
      expect(result.message).toMatch(/rejected/i);
    }
  });

  it("reads the queue window from the mocked RPC", async () => {
    const prepare = vi.fn(async () => ({
      result: { eta: 50, expires_at: 80 },
      signAndSend: vi.fn(),
    }));
    const client = rpc(prepare);
    const window = await readTimelockWindow({
      contractId: CONTRACT,
      proposalIdHex: PROPOSAL,
      rpc: client,
    });

    expect(window).toEqual({
      etaLedger: 50,
      expiresAtLedger: 80,
      currentLedger: 40,
    });
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ method: "get_operation", contractId: CONTRACT }),
    );
    expect(parseTimelockOperation(null)).toBeNull();
  });
});
