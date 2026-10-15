import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Amy AI — LearnAI Platform",
  description:
    "AI tutor for Bangladeshi students. Courses, quizzes, streaks, bKash/Nagad/SSLCommerz payments.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AmyAI",
  },
};

export const viewport: Viewport = {
  themeColor: "#58cc02",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ServiceWorkerRegister />
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
