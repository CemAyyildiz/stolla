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
    mockedUseWallet.mockReturnValue({
      address: "GBZ5Q6A3X7W9Q2A4B6C8D1E2F3G4H5I6J7K8L9M0N",
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
      isConnecting: false,
    } as ReturnType<typeof useWallet>);

    render(<Header />);

    const trigger = screen.getByRole("button", { name: /account/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText(/connected account/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const disconnectButton = await screen.findByRole("menuitem", { name: /disconnect/i });
    fireEvent.keyDown(disconnectButton, { key: "Enter" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
