import { UserRole } from "@prisma/client";
import * as z from "zod";

export const userRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});
