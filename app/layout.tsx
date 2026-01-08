import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastContainer } from "@/components/Toast";
import { ThemeProvider } from "@/components/ThemeProvider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const GLOBAL_SEO_ID = "global"; // Matches the ID used in the SEO management page

export async function generateMetadata(): Promise<Metadata> {
  try {
    const docRef = doc(db, "seoConfigs", GLOBAL_SEO_ID);
    const docSnap = await getDoc(docRef);

    let keywords: string[] = [];

    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data?.keywords) {
        keywords = data.keywords
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k.length > 0);
      }
    }

    return {
      title: "PadiPay Admin - Dashboard",
      description: "Admin dashboard for PadiPay payment platform",
      keywords,
    };
  } catch (error) {
    console.error("Failed to fetch dynamic SEO keywords:", error);
    // Fallback to static metadata if Firestore fetch fails
    return {
      title: "PadiPay Admin - Dashboard",
      description: "Admin dashboard for PadiPay payment platform",
      keywords: [],
    };
  }
}

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