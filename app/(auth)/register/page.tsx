import { redirect } from "next/navigation";

export const metadata = {
  title: "Créer un compte",
  description: "Créez un compte pour commencer.",
};

export default function RegisterPage() {
  // Avec Google OAuth, login et register sont identiques
  redirect("/login");
}
