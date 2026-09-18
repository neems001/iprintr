import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { AuthProvider } from "./context/auth-context";
import { isOAuthConfigured } from "@/lib/auth-config";

export const metadata: Metadata = {
  title: "iprintr | Hardware-Inspired Image Generator",
  description: "Generate images using AI engines in a clean, hardware-inspired UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = <AuthProvider>{children}</AuthProvider>;

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="hardware-line"></div>
        {isOAuthConfigured() ? <ClerkProvider>{content}</ClerkProvider> : content}
      </body>
    </html>
  );
}
