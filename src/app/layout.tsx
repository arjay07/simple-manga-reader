import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AdminProvider } from "@/components/AdminProvider";
import ProfileProvider from "@/components/ProfileProvider";
import { basePath } from "@/lib/basePath";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manga Reader",
  description: "A local manga reader for browsing and reading manga collections",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0a0a0a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href={`${basePath}/apple-touch-icon.png`} />
        <link rel="icon" href={`${basePath}/favicon.ico`} sizes="any" />
        <link rel="manifest" href={`${basePath}/manifest.webmanifest`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              })();
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('${process.env.NEXT_PUBLIC_BASE_PATH || ''}/sw.js');
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AdminProvider>
            <ProfileProvider>
              {children}
            </ProfileProvider>
          </AdminProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
