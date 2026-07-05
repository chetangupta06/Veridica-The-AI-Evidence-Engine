import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Network } from "lucide-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Veridica - The AI Evidence Engine",
  description: "Paste any claim. Get evidence, not opinions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1 flex flex-col">{children}</main>
              <footer className="border-t py-6 md:py-0 md:h-14 bg-card shrink-0 flex items-center justify-center text-sm text-muted-foreground mt-auto">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  <span>Powered by <strong>Mesh API</strong>. Building the consensus layer of the internet.</span>
                </div>
              </footer>
            </div>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
