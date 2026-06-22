
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from '@/context/SessionContext';

const siteUrl = "https://dashboard.bmybrand.com/";

const siteDescription =
  "Bmybrand's invoice portal helps clients and the company manage invoices, payments, projects, and account information in one secure place.";

const socialPreviewUrl = new URL("/Social%20preview%20image%202.png?v=2", siteUrl).toString();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bmybrand | Client Invoice Portal",
    template: "%s | Bmybrand",
  },
  description: siteDescription,
  applicationName: "Bmybrand",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Bmybrand",
    title: "Bmybrand | Client Invoice Portal",
    description: siteDescription,
    images: [
      {
        url: socialPreviewUrl,
        width: 1200,
        height: 630,
        alt: "Bmybrand client invoice portal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bmybrand | Client Invoice Portal",
    description: siteDescription,
    images: [socialPreviewUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div id="initial-app-loader" className="initial-app-loader" role="status" aria-live="polite" aria-label="Loading application">
          <div className="initial-app-loader__spinner" />
          <p>Loading</p>
        </div>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
