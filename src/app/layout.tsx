import type { Metadata, Viewport } from "next";
import { Rajdhani, IBM_Plex_Sans } from "next/font/google";
import { PwaProvider } from "@/components/PwaProvider";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ShotTrack",
  description: "Treine. Registre. Evolua.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "ShotTrack", statusBarStyle: "black-translucent" },
  // O Next só emite o `mobile-web-app-capable` padrão; o Safari do iPhone ainda lê o prefixo apple-
  other: { "apple-mobile-web-app-capable": "yes" },
};

// theme_color do manifest e da barra do navegador (--background em globals.css);
// viewport-fit=cover libera as áreas do notch — o CSS respeita com env(safe-area-inset-*)
export const viewport: Viewport = {
  themeColor: "#232323",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${rajdhani.variable} ${plexSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}