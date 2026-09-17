import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ViralLens — viral content research", template: "%s · ViralLens" },
  description: "Discover what's going viral on X, LinkedIn and Instagram, and learn why it works.",
  icons: { icon: [{ url: "/logo.webp", type: "image/webp" }, { url: "/favicon.ico" }], apple: "/logo.webp" },
};

// Applies the saved theme before paint to avoid a light/dark flash.
const themeScript = `try{var t=(JSON.parse(localStorage.getItem("virallens:prefs")||"{}").theme)||"dark";document.documentElement.classList.toggle("dark",t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))}catch(e){}`;

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          {modal}
        </Providers>
      </body>
    </html>
  );
}
