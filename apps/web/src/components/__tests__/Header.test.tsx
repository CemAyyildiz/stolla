import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Header } from "../Header";
import { useWallet } from "@/context/WalletProvider";

vi.mock("@/context/WalletProvider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const mockedUseWallet = vi.mocked(useWallet);

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a compact wallet trigger on small screens and supports keyboard disconnect", async () => {
    const disconnect = vi.fn();
    const address = "GBZ5Q6A3X7W9Q2A4B6C8D1E2F3G4H5I6J7K8L9M0N";
    mockedUseWallet.mockReturnValue({
      address,
      connect: vi.fn(),
      disconnect,
      signTransaction: vi.fn(),
      isConnecting: false,
      connectionError: null,
    } as ReturnType<typeof useWallet>);

    render(<Header />);

    const trigger = screen.getByRole("button", { name: /account/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText(/connected account/i)).toBeInTheDocument();
    expect(screen.getByText(address)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    const disconnectButton = await screen.findByRole("menuitem", { name: /disconnect/i });
    fireEvent.keyDown(disconnectButton, { key: "Enter" });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
