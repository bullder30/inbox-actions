import { MetadataRoute } from "next"

import { siteConfig } from "@/config/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/privacy", "/terms", "/contact"],
        disallow: [
          "/api/",
          "/dashboard",
          "/actions",
          "/settings",
          "/admin",
          "/accept-terms",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
