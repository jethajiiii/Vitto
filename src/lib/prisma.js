const { PrismaClient } = require('@prisma/client');

// Prevent multiple instances of Prisma Client in development (hot reload safety)
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
