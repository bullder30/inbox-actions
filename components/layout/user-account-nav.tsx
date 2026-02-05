"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLink, FileText, Home, Inbox, LogOut, Mail, Settings, Shield } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Drawer } from "vaul";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useState } from "react";

interface UserAccountNavProps {
  todoCount?: number;
}

export function UserAccountNav({ todoCount = 0 }: UserAccountNavProps) {
  const { data: session } = useSession();
  const user = session?.user;

  const [open, setOpen] = useState(false);
  const closeDrawer = () => {
    setOpen(false);
  };

  const { isMobile } = useMediaQuery();

  if (!user)
    return (
      <div className="size-8 animate-pulse rounded-full border bg-muted" />
    );

  if (isMobile) {
    return (
      <Drawer.Root open={open} onClose={closeDrawer}>
        <Drawer.Trigger onClick={() => setOpen(true)}>
          <UserAvatar
            user={{ email: user.email || null, image: user.image || null }}
            className="size-9 border"
          />
        </Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-0 z-40 h-full bg-background/80 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 overflow-hidden rounded-t-[10px] border bg-background px-3 text-sm">
            <div className="sticky top-0 z-20 flex w-full items-center justify-center bg-inherit">
              <div className="my-3 h-1.5 w-16 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col">
                {user.email && (
                  <p className="w-[200px] truncate font-medium">
                    {user.email}
                  </p>
                )}
              </div>
            </div>

            <ul role="list" className="mb-14 mt-1 w-full text-muted-foreground">
              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/dashboard"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <Home className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Accueil</p>
                </Link>
              </li>

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/actions"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <Inbox className="size-4 text-[#764ba2]" />
                  <p className="relative text-sm">
                    Actions
                    {todoCount > 0 && (
                      <span
                        className="absolute -right-3.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white"
                        style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                      >
                        {todoCount > 9 ? "9+" : todoCount}
                      </span>
                    )}
                  </p>
                </Link>
              </li>

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/settings"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <Settings className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Paramètres</p>
                </Link>
              </li>

              <li className="my-2 border-t" />

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/contact"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <Mail className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Contact</p>
                </Link>
              </li>

              <li className="px-2.5 py-2 text-xs font-medium text-muted-foreground">
                Informations légales
              </li>

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/terms"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <FileText className="size-4 text-[#764ba2]" />
                  <p className="text-sm">CGU</p>
                </Link>
              </li>

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="/privacy"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <Shield className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Confidentialité</p>
                </Link>
              </li>

              <li className="rounded-lg text-foreground hover:bg-muted">
                <Link
                  href="https://github.com/bullder30/inbox-actions"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDrawer}
                  className="flex w-full items-center gap-3 px-2.5 py-2"
                >
                  <ExternalLink className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Licence AGPL-3.0</p>
                </Link>
              </li>

              <li className="my-2 border-t" />

              <li
                className="rounded-lg text-foreground hover:bg-muted"
                onClick={(event) => {
                  event.preventDefault();
                  signOut({
                    callbackUrl: `${window.location.origin}/`,
                  });
                }}
              >
                <div className="flex w-full items-center gap-3 px-2.5 py-2">
                  <LogOut className="size-4 text-[#764ba2]" />
                  <p className="text-sm">Se déconnecter</p>
                </div>
              </li>
            </ul>
          </Drawer.Content>
          <Drawer.Overlay />
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <UserAvatar
          user={{ email: user.email || null, image: user.image || null }}
          className="size-8 border"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            {user.email && (
              <p className="w-[200px] truncate text-sm font-medium">
                {user.email}
              </p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex items-center space-x-2.5">
            <Home className="size-4 text-[#764ba2]" />
            <p className="text-sm">Accueil</p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/actions" className="flex items-center space-x-2.5">
            <Inbox className="size-4 text-[#764ba2]" />
            <p className="relative text-sm">
              Actions
              {todoCount > 0 && (
                <span
                  className="absolute -right-3.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white"
                  style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                >
                  {todoCount > 9 ? "9+" : todoCount}
                </span>
              )}
            </p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center space-x-2.5"
          >
            <Settings className="size-4 text-[#764ba2]" />
            <p className="text-sm">Paramètres</p>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/contact" className="flex items-center space-x-2.5">
            <Mail className="size-4 text-[#764ba2]" />
            <p className="text-sm">Contact</p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Informations légales
        </DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link href="/terms" className="flex items-center space-x-2.5">
            <FileText className="size-4 text-[#764ba2]" />
            <p className="text-sm">CGU</p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/privacy" className="flex items-center space-x-2.5">
            <Shield className="size-4 text-[#764ba2]" />
            <p className="text-sm">Confidentialité</p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            href="https://github.com/bullder30/inbox-actions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2.5"
          >
            <ExternalLink className="size-4 text-[#764ba2]" />
            <p className="text-sm">Licence AGPL-3.0</p>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(event) => {
            event.preventDefault();
            signOut({
              callbackUrl: `${window.location.origin}/`,
            });
          }}
        >
          <div className="flex items-center space-x-2.5">
            <LogOut className="size-4 text-[#764ba2]" />
            <p className="text-sm">Se déconnecter</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
