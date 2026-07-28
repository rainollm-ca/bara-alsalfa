import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lamma.rainomotion.com"),
  title: "لمّة | Lamma — Play together",
  description: "ألعاب جماعية عربية وإنجليزية للعائلة والأصدقاء، على جهاز واحد أو عدة أجهزة | Bilingual party games for every gathering.",
  applicationName: "Lamma | لمّة",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Lamma | لمّة",
    title: "لمّة | Lamma — Play together",
    description: "Bilingual party games for family and friends, on one device or across the whole room.",
    images: [{ url: "/games/lamma-game-covers-sheet.png", width: 1536, height: 1024, alt: "Lamma party game collection" }],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    shortcut: "/icons/icon-192.png",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "لمّة",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#123D3A",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem("lamma-locale")||localStorage.getItem("bara-locale");if(l==="ar"||l==="en"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr"}}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
