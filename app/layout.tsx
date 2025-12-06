import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastContainer } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PadiPay Admin - Dashboard",
  description: "Admin dashboard for PadiPay payment platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-gray-50 dark:bg-gray-900`}>
        <ThemeProvider />
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
