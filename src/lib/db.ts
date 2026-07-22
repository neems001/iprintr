import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const databaseUrl =
  process.env.IPRINTR_URL ||
  process.env.IPRINTR_PRISMA_URL ||
  process.env.POSTGRES_URL;

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl
      ? {
        db: {
          url: databaseUrl,
        },
      }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
