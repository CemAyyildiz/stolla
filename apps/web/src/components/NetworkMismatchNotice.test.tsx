import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Networks } from "@stellar/stellar-sdk";
import { NetworkMismatchNotice } from "./NetworkMismatchNotice";
import { NETWORKS, compareNetworks, describeNetwork } from "@/lib/network";

const mismatch = compareNetworks(
  NETWORKS.testnet,
  describeNetwork(Networks.PUBLIC),
);

describe("NetworkMismatchNotice", () => {
  it("names the expected and detected networks", () => {
    render(<NetworkMismatchNotice comparison={mismatch} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Expected");
    expect(alert).toHaveTextContent("Testnet");
    expect(alert).toHaveTextContent("Detected");
    expect(alert).toHaveTextContent("Mainnet");
  });

  it("explains what the mismatch invalidated", () => {
    render(
      <NetworkMismatchNotice
        comparison={mismatch}
        consequence="The simulation was discarded."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The simulation was discarded.",
    );
  });

  it("renders nothing while the networks agree", () => {
    render(
      <NetworkMismatchNotice
        comparison={compareNetworks(
          NETWORKS.testnet,
          describeNetwork(Networks.TESTNET),
        )}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders nothing while the wallet network is unknown", () => {
    render(
      <NetworkMismatchNotice comparison={compareNetworks(NETWORKS.testnet, null)} />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
