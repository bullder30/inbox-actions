import { SiteConfig } from "types";

import { env } from "@/env.mjs";

const site_url = env.NEXT_PUBLIC_APP_URL;

export const siteConfig: SiteConfig = {
  name: "Inbox Actions",
  description:
    "Transformez vos emails en actions concrètes. Inbox Actions extrait automatiquement les tâches de vos emails Gmail et les organise pour vous.",
  url: site_url,
  ogImage: `${site_url}/_static/og.jpg`,
};
