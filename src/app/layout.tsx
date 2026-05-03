import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX CRM | Real Estate Management",
  description: "Premium CRM za Apex Real Estate - upravljanje nekretninama, kupcima i agentima",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
