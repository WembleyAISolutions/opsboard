import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpsBoard v0.1",
  description: "Lightweight human-AI work gateway for ChatGPT-centered multi-agent workflows."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
