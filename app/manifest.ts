import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudyRats",
    short_name: "StudyRats",
    description:
      "Log study sessions, earn a point for every minute, and climb your group's leaderboard.",
    start_url: "/groups",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12203a",
    theme_color: "#12203a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
