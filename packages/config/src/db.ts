import { z } from 'zod';
import { loadEnv } from './utils/load-env';

// Загружаем специфичный файл из корня: /.env.db
loadEnv('.env.db');

const dbSchema = z.object({
    DATABASE_URL: z.url(),
    DB_POOL_SIZE: z.coerce.number().default(10),
});

export const dbConfig = dbSchema.parse(process.env);