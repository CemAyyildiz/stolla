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
import {
  KitEventType,
  type Networks,
} from "@creit.tech/stellar-wallets-kit/types";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import {
  NetworkMismatchError,
  describeNetwork,
  type DetectedNetwork,
} from "@/lib/network";
import { activeNetwork } from "@/lib/stellar";

/** Freighter reports its network only on request, so the wallet is re-read on a timer. */
const NETWORK_POLL_INTERVAL_MS = 4000;

type WalletContextValue = {
  address: string | null;
  walletNetwork: DetectedNetwork | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
  isConnecting: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

let kitInitialized = false;

function ensureKit() {
  if (!kitInitialized && typeof window !== "undefined") {
    StellarWalletsKit.init({
      modules: [new FreighterModule()],
      network: activeNetwork.passphrase as Networks,
    });
    kitInitialized = true;
  }
}

async function readWalletNetwork(): Promise<DetectedNetwork | null> {
  try {
    const { network, networkPassphrase } = await StellarWalletsKit.getNetwork();
    return describeNetwork(networkPassphrase, network);
  } catch {
    return null;
  }
}

/** Wallets that push state changes are picked up immediately; the rest rely on polling. */
function subscribeToModuleChanges(
  handler: (event: { network: string; networkPassphrase: string }) => void,
) {
  try {
    StellarWalletsKit.selectedModule.onChange?.(handler);
  } catch {
    // No module is selected yet, so there is nothing to subscribe to.
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [detectedNetwork, setDetectedNetwork] =
    useState<DetectedNetwork | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  /** A disconnected wallet reports no network, whatever was last read. */
  const walletNetwork = address ? detectedNetwork : null;

  const syncWalletNetwork = useCallback(async () => {
    if (!kitInitialized || !address) return;
    setDetectedNetwork(await readWalletNetwork());
  }, [address]);

  useEffect(() => {
    if (!kitInitialized) return;
    const unsubscribe = StellarWalletsKit.on(
      KitEventType.STATE_UPDATED,
      (event) => {
        setAddress(event.payload.address ?? null);
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    const sync = () => {
      if (!cancelled) void syncWalletNetwork();
    };

    sync();
    const interval = window.setInterval(sync, NETWORK_POLL_INTERVAL_MS);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    subscribeToModuleChanges((event) => {
      if (!cancelled) {
        setDetectedNetwork(
          describeNetwork(event.networkPassphrase, event.network),
        );
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [address, syncWalletNetwork]);

  const connect = useCallback(async () => {
    ensureKit();
    setIsConnecting(true);
    try {
      const { address: walletAddress } = await StellarWalletsKit.authModal();
      setAddress(walletAddress);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "");
      if (message !== "The user closed the modal.") {
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
    setDetectedNetwork(null);
  }, []);

  /**
   * The wallet network is read fresh on every signature instead of taken from
   * state, so a switch between render and click cannot slip a mismatched
   * passphrase into a signed transaction.
   */
  const signTransaction = useCallback(async (xdr: string) => {
    ensureKit();
    const detected = await readWalletNetwork();
    setDetectedNetwork(detected);
    if (detected?.passphrase !== activeNetwork.passphrase) {
      throw new NetworkMismatchError(activeNetwork, detected);
    }
    return StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: activeNetwork.passphrase,
    });
  }, []);

  const value = useMemo(
    () => ({
      address,
      walletNetwork,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
    }),
    [
      address,
      walletNetwork,
      connect,
      disconnect,
      signTransaction,
      isConnecting,
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
