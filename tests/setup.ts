import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock next/cache (revalidatePath/revalidateTag/unstable_cache require Next.js runtime context)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  // Pass-through : exécute la fn directement sans cache (transparent dans les tests)
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// Mock NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => {
  const prismaMock: Record<string, unknown> = {
    // $transaction supporte les deux formes :
    // - array de Promises -> Promise.all
    // - callback (tx) -> appelle avec `prismaMock` comme tx (les tests mockent les modèles directement)
    $transaction: vi.fn((arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
      }
      return Promise.all(arg as unknown[]);
    }),
    action: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    customActionType: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    emailMetadata: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    microsoftGraphMailbox: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    iMAPCredential: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    userExclusion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { prisma: prismaMock };
});
