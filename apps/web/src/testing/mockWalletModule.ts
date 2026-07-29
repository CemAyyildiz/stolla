import { Buffer } from "buffer";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  ModuleType,
  type ModuleInterface,
} from "@creit.tech/stellar-wallets-kit/types";

/** Derived from a fixed seed so the address is stable across runs and machines. */
const MOCK_KEYPAIR = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));

export const MOCK_WALLET_ID = "stolla-mock-wallet";
export const MOCK_WALLET_ADDRESS = MOCK_KEYPAIR.publicKey();

export type MockWalletControls = {
  network: string;
  networkPassphrase: string;
  rejectSignature: boolean;
};

export type MockWalletRecord = {
  signedNetworkPassphrases: string[];
};

declare global {
  interface Window {
    __stollaMockWallet?: Partial<MockWalletControls>;
    __stollaMockWalletRecord?: MockWalletRecord;
  }
}

const DEFAULT_CONTROLS: MockWalletControls = {
  network: "TESTNET",
  networkPassphrase: Networks.TESTNET,
  rejectSignature: false,
};

function controls(): MockWalletControls {
  return { ...DEFAULT_CONTROLS, ...globalThis.window?.__stollaMockWallet };
}

/**
 * Records what the application asked the wallet to sign. The Playwright suite
 * reads this to assert the passphrase reached the wallet, which a transaction
 * envelope alone cannot show.
 */
function recordSignature(networkPassphrase: string) {
  const record = (window.__stollaMockWalletRecord ??= {
    signedNetworkPassphrases: [],
  });
  record.signedNetworkPassphrases.push(networkPassphrase);
}

export class MockWalletModule implements ModuleInterface {
  moduleType = ModuleType.HOT_WALLET;
  productId = MOCK_WALLET_ID;
  productName = "Mock Wallet";
  productUrl = "https://example.test/mock-wallet";
  productIcon = "";

  async isAvailable() {
    return true;
  }

  async getAddress() {
    return { address: MOCK_WALLET_ADDRESS };
  }

  async getNetwork() {
    const { network, networkPassphrase } = controls();
    return { network, networkPassphrase };
  }

  /**
   * Signs for real with the mock key. The signature covers the network id, so a
   * transaction signed under the wrong passphrase fails verification rather than
   * passing silently.
   */
  async signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string },
  ): Promise<{ signedTxXdr: string; signerAddress: string }> {
    const networkPassphrase = opts?.networkPassphrase ?? Networks.TESTNET;
    recordSignature(networkPassphrase);

    if (controls().rejectSignature) {
      throw new Error("User declined access");
    }

    const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
    transaction.sign(MOCK_KEYPAIR);
    return {
      signedTxXdr: transaction.toXDR(),
      signerAddress: MOCK_WALLET_ADDRESS,
    };
  }

  async signAuthEntry(): Promise<{ signedAuthEntry: string }> {
    throw new Error("signAuthEntry is not supported by the mock wallet.");
  }

  async signMessage(): Promise<{ signedMessage: string }> {
    throw new Error("signMessage is not supported by the mock wallet.");
  }
}
