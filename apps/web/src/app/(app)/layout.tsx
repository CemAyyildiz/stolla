import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { WalletProvider } from "@/context/WalletProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletProvider>
      <Header />
      <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      <Footer />
    </WalletProvider>
  );
}
