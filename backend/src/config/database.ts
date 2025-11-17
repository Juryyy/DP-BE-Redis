import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Connection test
prisma
  .$connect()
  .then(() => logger.info('Database connected'))
  .catch((error) => logger.error('Database connection error:', error));

// Graceful shutdown
export const closeDatabaseConnection = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
};

export default prisma;
