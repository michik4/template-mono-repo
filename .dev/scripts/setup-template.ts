// Файл: .dev/scripts/setup-template.ts
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const REPO_ROOT = path.resolve(import.meta.dir, "../../");

// Папки, которые мы не трогаем при поиске и замене
const IGNORE_DIRS = [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".turbo",
    "coverage",
    "code_snapshots"
];

// Расширения файлов, в которых будет производиться замена
const TARGET_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".json", ".md", ".css", ".html", ".yml", ".yaml"];

// Значения по умолчанию, заложенные в шаблоне
const DEFAULT_SCOPE = "@repo";
const DEFAULT_PROJECT_NAME = "mono-repo-template"; // Учитываем опечатку из package.json

function printHelp() {
    console.log(`
Утилита настройки шаблона монорепозитория.

Использование:
  bun .dev/scripts/setup-template.ts --scope @mycompany --name my-project

Опции:
  --scope <ИМЯ>     Новый scope для пакетов (например, @myorg). Заменит ${DEFAULT_SCOPE}.
  --name <ИМЯ>      Новое имя проекта. Заменит ${DEFAULT_PROJECT_NAME}.
  -h, --help        Показать эту справку.
`);
}

async function* walk(dir: string): AsyncGenerator<string> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(fullPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (TARGET_EXTENSIONS.includes(ext) || entry.name.startsWith(".env")) {
                yield fullPath;
            }
        }
    }
}

async function main() {
    const { values } = parseArgs({
        args: process.argv.slice(2),
        options: {
            scope: { type: "string" },
            name: { type: "string" },
            help: { type: "boolean", short: "h" },
        },
    });

    if (values.help || (!values.scope && !values.name)) {
        printHelp();
        process.exit(0);
    }

    const newScope = values.scope ? values.scope.replace(/\/$/, "") : null;
    const newName = values.name;

    let filesChanged = 0;

    console.log("🚀 Начинаем настройку шаблона...\n");

    for await (const filePath of walk(REPO_ROOT)) {
        let content = await fs.promises.readFile(filePath, "utf-8");
        let modified = false;

        if (newScope && content.includes(`${DEFAULT_SCOPE}/`)) {
            content = content.replaceAll(`${DEFAULT_SCOPE}/`, `${newScope}/`);
            modified = true;
        }
        if (newScope && content.includes(`"${DEFAULT_SCOPE}"`)) {
            // Для случаев без слеша
            content = content.replaceAll(`"${DEFAULT_SCOPE}"`, `"${newScope}"`);
            modified = true;
        }

        if (newName && content.includes(DEFAULT_PROJECT_NAME)) {
            content = content.replaceAll(DEFAULT_PROJECT_NAME, newName);
            modified = true;
        }

        if (modified) {
            await fs.promises.writeFile(filePath, content, "utf-8");
            console.log(`✅ Обновлен: ${path.relative(REPO_ROOT, filePath)}`);
            filesChanged++;
        }
    }

    console.log(`\n🎉 Настройка завершена! Изменено файлов: ${filesChanged}`);
    if (newScope) console.log(`👉 Scope пакетов изменен на: ${newScope}`);
    if (newName) console.log(`👉 Имя проекта изменено на: ${newName}`);

    console.log(`\nНе забудьте запустить "bun install" для обновления lock-файла!`);
}

main().catch(console.error);