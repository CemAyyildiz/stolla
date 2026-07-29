import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Networks } from "@stellar/stellar-sdk";
import { WalletProvider, useWallet } from "./WalletProvider";

const kit = vi.hoisted(() => ({
  init: vi.fn(),
  on: vi.fn(() => () => {}),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(async () => ({ signedTxXdr: "SIGNED" })),
  disconnect: vi.fn(),
  authModal: vi.fn(),
  selectedModule: { onChange: undefined },
}));

vi.mock("@creit.tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: kit,
}));
vi.mock("@creit.tech/stellar-wallets-kit/modules/freighter", () => ({
  FreighterModule: class {},
}));
vi.mock("@creit.tech/stellar-wallets-kit/types", () => ({
  KitEventType: { STATE_UPDATED: "STATE_UPDATE" },
}));

function SigningHarness() {
  const { signTransaction } = useWallet();
  const [outcome, setOutcome] = useState("");

  return (
    <>
      <button
        type="button"
        onClick={() =>
          signTransaction("UNSIGNED").then(
            (result) => setOutcome(result.signedTxXdr),
            (error: Error) => setOutcome(`rejected: ${error.message}`),
          )
        }
      >
        sign
      </button>
      <p data-testid="outcome">{outcome}</p>
    </>
  );
}

async function sign() {
  render(
    <WalletProvider>
      <SigningHarness />
    </WalletProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "sign" }));
  await waitFor(() =>
    expect(screen.getByTestId("outcome")).not.toBeEmptyDOMElement(),
  );
  return screen.getByTestId("outcome").textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  kit.signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED" });
});

describe("signTransaction", () => {
  it("signs with the application passphrase when the wallet agrees", async () => {
    kit.getNetwork.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: Networks.TESTNET,
    });

    expect(await sign()).toBe("SIGNED");
    expect(kit.signTransaction).toHaveBeenCalledWith("UNSIGNED", {
      networkPassphrase: Networks.TESTNET,
    });
  });

  it("refuses to hand the transaction to a wallet on another network", async () => {
    kit.getNetwork.mockResolvedValue({
      network: "PUBLIC",
      networkPassphrase: Networks.PUBLIC,
    });

    expect(await sign()).toContain("Mainnet");
    expect(kit.signTransaction).not.toHaveBeenCalled();
  });

  it("refuses when the wallet network cannot be read", async () => {
    kit.getNetwork.mockRejectedValue(new Error("wallet locked"));

    expect(await sign()).toContain("Could not read the wallet network");
    expect(kit.signTransaction).not.toHaveBeenCalled();
  });

  it("re-reads the wallet on every signature rather than caching it", async () => {
    kit.getNetwork
      .mockResolvedValueOnce({
        network: "TESTNET",
        networkPassphrase: Networks.TESTNET,
      })
      .mockResolvedValueOnce({
        network: "PUBLIC",
        networkPassphrase: Networks.PUBLIC,
      });

    render(
      <WalletProvider>
        <SigningHarness />
      </WalletProvider>,
    );
    const button = screen.getByRole("button", { name: "sign" });

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("SIGNED"),
    );

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByTestId("outcome")).toHaveTextContent("Mainnet"),
    );
    expect(kit.signTransaction).toHaveBeenCalledTimes(1);
  });
});
