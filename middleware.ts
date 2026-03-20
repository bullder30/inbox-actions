export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Exclure les routes qui ne nécessitent pas le middleware Auth.js :
     * - Fichiers statiques Next.js (_next/static, _next/image)
     * - Fichiers SEO publics (sitemap.xml, robots.txt, manifest, icons, og-image)
     * - Fichiers statiques du dossier public (_static, favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|icon|icon-192|apple-icon|opengraph-image|_static).*)",
  ],
};