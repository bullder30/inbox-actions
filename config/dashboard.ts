import { SidebarNavItem } from "types";

export const sidebarLinks: SidebarNavItem[] = [
  {
    title: "MENU",
    items: [
      { href: "/dashboard", icon: "dashboard", title: "Tableau de bord" },
      { href: "/actions", icon: "inbox", title: "Actions" },
    ],
  },
  {
    title: "OPTIONS",
    items: [
      { href: "/settings", icon: "settings", title: "Paramètres" },
    ],
  },
];
