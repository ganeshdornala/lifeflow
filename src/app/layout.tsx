import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeFlow — Get important things done",
  description: "Organize important commitments, understand dependencies, and complete real-world responsibilities with confidence.",
};

export default function RootLayout({ children, }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" >
      <body>{children}</body>
    </html>
  );
}
