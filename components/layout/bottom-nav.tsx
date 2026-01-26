"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Inbox, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  todoCount?: number;
}

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Tableau",
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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background md:hidden">
      {/* Safe area padding for iOS */}
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="size-5" />
                {item.showBadge && todoCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {todoCount > 9 ? "9+" : todoCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1 h-0.5 w-8 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
