"use client";

import { Home, Inbox, Settings } from "lucide-react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface BottomNavProps {
  todoCount?: number;
}

const navItems = [
  {
    href: "/dashboard",
    icon: Home,
    label: "Accueil",
  },
  {
    href: "/actions",
    icon: Inbox,
    label: "Actions",
    showBadge: true,
  },
  {
    href: "/settings",
    icon: Settings,
    label: "Paramètres",
  },
];

export function BottomNav({ todoCount = 0 }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-6 md:hidden" style={{ width: "100vw" }}>
      {/* Floating navigation bar with purple border */}
      <nav className="w-full max-w-md rounded-2xl border border-[#764ba2] bg-background/30 shadow-lg shadow-black/5 backdrop-blur-sm dark:bg-background/25 dark:shadow-black/20">
        <div className="flex h-14 items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-all duration-200 active:scale-95"
              >
                {/* Active background indicator */}
                {isActive && (
                  <div
                    className="absolute inset-1 rounded-xl opacity-10"
                    style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                  />
                )}
                <div className="relative z-10">
                  <Icon className={cn("size-5 transition-transform text-[#764ba2]", isActive && "scale-110")} />
                  {item.showBadge && todoCount > 0 && (
                    <span
                      className="absolute -right-2.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm"
                      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                    >
                      {todoCount > 9 ? "9+" : todoCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "relative z-10 text-[10px] font-medium text-[#764ba2] transition-all",
                  isActive ? "font-semibold opacity-100" : "opacity-70"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
