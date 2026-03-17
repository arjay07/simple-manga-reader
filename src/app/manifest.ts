import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manga Reader",
    short_name: "Manga",
    description:
      "A local manga reader for browsing and reading manga collections",
    start_url: "/",
    display: "standalone",
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    icons: [
      {
        src: "/favicon.ico",
        type: "image/x-icon",
        sizes: "16x16 32x32",
      },
      {
        src: "/icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
      },
      {
        src: "/icon-192-maskable.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "maskable",
      },
      {
        src: "/icon-512-maskable.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
