import { z } from 'zod';
import { loadEnv } from './utils/load-env';

// Загружаем специфичный файл из корня: /.env.backend
loadEnv('.env.backend');

const backendSchema = z.object({
    PORT: z.coerce.number().default(3333),
    JWT_SECRET: z.string().min(16),
});

export const backendConfig = backendSchema.parse(process.env);