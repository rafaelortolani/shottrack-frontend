import type { MetadataRoute } from "next";

// Cores do tema (src/app/globals.css: --background). O manifest não enxerga
// tokens CSS, então o valor é repetido aqui.
const BACKGROUND = "#232323";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ShotTrack",
    short_name: "ShotTrack",
    description: "Treine. Registre. Evolua. Seus treinos de tiro esportivo no celular.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Treinos", url: "/treinos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
