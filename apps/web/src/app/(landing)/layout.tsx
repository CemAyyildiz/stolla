import { LandingChrome } from "@/components/landing/LandingChrome";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="landing-root min-h-screen">
      <LandingChrome />
      <LandingHeader />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
