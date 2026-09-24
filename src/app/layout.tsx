import type { Metadata } from "next";
import { Rajdhani, IBM_Plex_Sans } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${rajdhani.variable} ${plexSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}