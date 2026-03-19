import "@/styles/globals.css";

import { cn, constructMetadata } from "@/lib/utils";
import { fontGeist, fontHeading, fontSans, fontUrban } from "@/assets/fonts";

import { Analytics } from "@/components/analytics";
import ModalProvider from "@/components/modals/providers";
import { SessionProvider } from "next-auth/react";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

interface RootLayoutProps {
  children: React.ReactNode;
}

export const metadata = constructMetadata();

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="UQ0xMNhEgPBsQzoSXW_t1f2Uhro5ky6qZ3ZWtI8vyok" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Inbox Actions",
              description:
                "Transformez vos emails en actions concrètes. Inbox Actions extrait automatiquement les tâches de vos emails Gmail, Outlook et IMAP et les organise pour vous.",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: "https://inbox-actions.com",
              screenshot: "https://inbox-actions.com/_static/og.jpg",
              inLanguage: "fr",
              author: {
                "@type": "Person",
                name: "bullder30",
                url: "https://twitter.com/bullder30",
              },
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
              },
            }),
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
          fontUrban.variable,
          fontHeading.variable,
          fontGeist.variable,
        )}
      >
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ModalProvider>{children}</ModalProvider>
            <Analytics />
            <Toaster richColors closeButton />
            <TailwindIndicator />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
