import { drizzle } from 'drizzle-orm/node-postgres';
import { dbConfig } from '@repo/config/db';

export const db = drizzle(dbConfig.DATABASE_URL);