
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Expense Tracker",
  description: "Manage your income, expenses and budgets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
