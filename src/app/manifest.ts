import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS",
    short_name: "LifeOS",
    id: "/",
    description: "Private personal planning and workload management",
    start_url: "/today",
    display: "standalone",
    background_color: "#0f1419",
    theme_color: "#0f1419",
    orientation: "portrait-primary",
    scope: "/",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
