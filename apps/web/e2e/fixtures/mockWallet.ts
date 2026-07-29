import type { Page } from "@playwright/test";
import { Keypair, Networks } from "@stellar/stellar-sdk";

export const MOCK_WALLET_ADDRESS = Keypair.fromRawEd25519Seed(
  Buffer.alloc(32, 7),
).publicKey();

export type MockWalletSetup = {
  network?: string;
  networkPassphrase?: string;
  rejectSignature?: boolean;
};

export async function configureMockWallet(
  page: Page,
  setup: MockWalletSetup = {},
) {
  await page.addInitScript((controls) => {
    window.__stollaMockWallet = controls;
  }, {
    network: "TESTNET",
    networkPassphrase: Networks.TESTNET,
    rejectSignature: false,
    ...setup,
  });
}

/** The passphrases the application actually handed to the wallet for signing. */
export function signedNetworkPassphrases(page: Page): Promise<string[]> {
  return page.evaluate(
    () => window.__stollaMockWalletRecord?.signedNetworkPassphrases ?? [],
  );
}
