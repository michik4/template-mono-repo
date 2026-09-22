import { drizzle } from 'drizzle-orm/node-postgres';
import { dbConfig } from '@sr4/config/db';

export const db = drizzle(dbConfig.DATABASE_URL);