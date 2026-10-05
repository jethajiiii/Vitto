const { PrismaClient } = require('@prisma/client');

// Global Prisma Client singleton safe for Next.js hot reload in development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
