import type { MetadataRoute } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Manga Reader",
    short_name: "Manga",
    description:
      "A local manga reader for browsing and reading manga collections",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    icons: [
      {
        src: `${basePath}/favicon.ico`,
        type: "image/x-icon",
        sizes: "16x16 32x32",
      },
      {
        src: `${basePath}/icon-192.png`,
        type: "image/png",
        sizes: "192x192",
      },
      {
        src: `${basePath}/icon-512.png`,
        type: "image/png",
        sizes: "512x512",
      },
      {
        src: `${basePath}/icon-192-maskable.png`,
        type: "image/png",
        sizes: "192x192",
        purpose: "maskable",
      },
      {
        src: `${basePath}/icon-512-maskable.png`,
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
  };
}
