"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { Networks, KitEventType } from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";

export type WalletConnectionError = {
  code: "request-rejected" | "wallet-unavailable" | "connection-failed";
  message: string;
};

type WalletContextValue = {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
  isConnecting: boolean;
  connectionError: WalletConnectionError | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;
const MODAL_DISMISSED_MESSAGE = "The user closed the modal.";

function walletErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: undefined,
      message: typeof error === "string" ? error : "",
    };
  }

  const errorLike = error as {
    code?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown };
  };
  const nestedError =
    errorLike.error && typeof errorLike.error === "object"
      ? errorLike.error
      : undefined;

  return {
    code:
      typeof nestedError?.code === "number"
        ? nestedError.code
        : typeof errorLike.code === "number"
          ? errorLike.code
          : undefined,
    message:
      typeof nestedError?.message === "string"
        ? nestedError.message
        : typeof errorLike.message === "string"
          ? errorLike.message
          : "",
  };
}

export function toWalletConnectionError(
  error: unknown,
): WalletConnectionError | null {
  const { code, message } = walletErrorDetails(error);

  if (message === MODAL_DISMISSED_MESSAGE) {
    return null;
  }

  if (code === -4 || /reject|declin|denied/i.test(message)) {
    return {
      code: "request-rejected",
      message:
        "Connection request declined. Approve the request in your wallet to connect.",
    };
  }

  if (
    /not (?:installed|connected|available)|unavailable|unsupported|no wallet/i.test(
      message,
    )
  ) {
    return {
      code: "wallet-unavailable",
      message:
        "Freighter is unavailable. Install or unlock the wallet, then try again.",
    };
  }

  return {
    code: "connection-failed",
    message: "We couldn't connect to your wallet. Please try again.",
  };
}

function ensureKit() {
  if (!kitInitialized && typeof window !== "undefined") {
    StellarWalletsKit.init({
      modules: [new FreighterModule()],
      network: Networks.TESTNET,
    });
    kitInitialized = true;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] =
    useState<WalletConnectionError | null>(null);

  useEffect(() => {
    if (!kitInitialized) return;
    const unsubscribe = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      (event) => {
        const updatedAddress = event.payload.address ?? null;
        setAddress(updatedAddress);
        if (updatedAddress) {
          setConnectionError(null);
        }
      },
    );
    return () => unsubscribe();
  }, []);

  const connect = useCallback(async () => {
    setConnectionError(null);
    setIsConnecting(true);
    try {
      ensureKit();
      const { address: walletAddress } = await StellarWalletsKit.authModal();
      setAddress(walletAddress);
      setConnectionError(null);
    } catch (error) {
      const safeError = toWalletConnectionError(error);
      setConnectionError(safeError);
      if (safeError) {
        console.error("Wallet connect failed:", error);
      }
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    ensureKit();
    void StellarWalletsKit.disconnect();
    setAddress(null);
    setConnectionError(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string) => {
    ensureKit();
    return StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
    });
  }, []);

  const value = useMemo(
    () => ({
      address,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
      connectionError,
    }),
    [
      address,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
      connectionError,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
