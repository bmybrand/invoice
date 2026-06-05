
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from '@/context/SessionContext';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.NEXT_PUBLIC_BRIEF_FORMS_PUBLIC_BASE_URL
  ?? "https://bmybrand.vercel.app";

const siteDescription =
  "Bmybrand's invoice portal helps clients and the company manage invoices, payments, projects, and account information in one secure place.";

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
    siteName: "Bmybrand",
    title: "Bmybrand | Client Invoice Portal",
    description: siteDescription,
    images: [
      {
        url: "/bmybrand-social-preview.png",
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
    images: ["/bmybrand-social-preview.png"],
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
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
