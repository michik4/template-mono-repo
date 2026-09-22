import { config } from 'dotenv';
import path from 'node:path';

export function loadEnv(filename: string) {
    // Так как файл лежит в packages/config/src/utils,
    // поднимаемся на 4 уровня вверх, чтобы попасть в корень монорепозитория
    const monorepoRoot = path.resolve(import.meta.dirname, '../../../../');

    // Загружаем переменные из указанного файла
    config({ path: path.join(monorepoRoot, filename) });
}