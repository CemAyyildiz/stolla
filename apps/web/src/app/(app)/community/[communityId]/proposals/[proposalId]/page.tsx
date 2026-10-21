"use client";

import { useParams } from "next/navigation";
import { CommunityProposalDetailView } from "@/components/community/CommunityProposalDetailView";
import { useOptionalWallet } from "@/context/WalletProvider";
import { compareNetworks, describeNetwork } from "@/lib/network";
import { activeCapabilities } from "@/lib/stellar";

export default function CommunityProposalDetailPage() {
  const params = useParams<{ communityId: string; proposalId: string }>();
  const wallet = useOptionalWallet();
  const comparison = wallet?.walletNetworkPassphrase
    ? compareNetworks(
        activeCapabilities.network,
        describeNetwork(
          wallet.walletNetworkPassphrase,
          typeof wallet.walletNetwork === "string" ? wallet.walletNetwork : undefined,
        ),
      )
    : null;

  return (
    <CommunityProposalDetailView
      communityId={params.communityId}
      proposalId={params.proposalId}
      walletAddress={wallet?.address}
      signTransaction={wallet?.signTransaction}
      walletConnected={Boolean(wallet?.address)}
      correctNetwork={!wallet || comparison === null || comparison.status === "match"}
    />
  );
}
