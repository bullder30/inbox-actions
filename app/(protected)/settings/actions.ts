"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateNotificationPreferences(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const emailNotifications = formData.get("emailNotifications") === "on";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailNotifications },
  });

  revalidatePath("/settings");

  return { success: true };
}
