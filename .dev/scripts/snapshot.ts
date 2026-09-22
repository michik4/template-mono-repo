// Файл: .dev/scripts/snapshot.ts
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import * as ansi from "../utils/ansi";
import { getFileEntries, formatFileContent, calculateHash, type PrintallOptions, type FileEntry } from "../utils/printall";

const REPO_ROOT = path.resolve(import.meta.dir, "../../");
const DEV_DIR = path.join(REPO_ROOT, ".dev");

const BASE_OMITS = [
    "node_modules", "__pycache__",
    "dist/", "build/", "builds/", "coverage/", "storybook-static/",
    "target/", "venv/", "vendor/", "__snapshots__/", ".turbo/",
    ".min.js", ".min.css", ".js.map", ".css.map", ".ts.map", ".tsbuildinfo", ".lock",
    ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
];

const TARGET_ROOTS = [path.join(REPO_ROOT, "apps"), path.join(REPO_ROOT, "packages")];
const OUT_DIR = path.join(DEV_DIR, "code_snapshots");

function rel(p: string) {
    return path.relative(REPO_ROOT, p).replaceAll("\\", "/");
}

function resolveTarget(raw: string): string {
    const absPath = path.resolve(raw);
    if (fs.existsSync(absPath)) return absPath;

    for (const root of TARGET_ROOTS) {
        const candidate = path.join(root, raw);
        if (fs.existsSync(candidate)) return candidate;
    }

    throw new Error(`Цель '${raw}' не найдена`);
}

function getAvailableTargets(): string[] {
    const names: string[] = [];
    for (const root of TARGET_ROOTS) {
        if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
            const dirs = fs.readdirSync(root, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith("."))
                .map(d => d.name);
            names.push(...dirs);
        }
    }
    return names.sort();
}

function getGitRevision(): string | null {
    try {
        const res = spawnSync("git", ["-C", REPO_ROOT, "rev-parse", "--short", "HEAD"], { encoding: "utf-8" });
        if (res.status !== 0) return null;
        const rev = res.stdout.trim();

        const status = spawnSync("git", ["-C", REPO_ROOT, "status", "--porcelain"], { encoding: "utf-8" });
        return status.stdout.trim() ? `${rev} (dirty)` : rev;
    } catch {
        return null;
    }
}

function printHelp() {
    const b = ansi.Style.BOLD;
    const c = ansi.Style.CYAN;
    const d = ansi.Style.DIM;
    const cl = ansi.Style.RESET;

    console.log(`
Снапшоты репозитория.

${ansi.paint('Виды снапшотов:', b)}
  ${ansi.paint('code', c)} \tMarkdown-снапшот исходников (.dev/utils/printall). Собирает файлы выбранных целей в один .md — 
    \tудобно отдать целиком в контекст LLM или сверить с другим снапшотом по контрольной сумме.


${ansi.paint('Опции:', b)}
  --global                  Снапшот всего проекта (не сочетается с целями)
  --out <ФАЙЛ>              Имя выходного файла
  --stdout                  Дополнительно вывести снапшот в консоль
  --dry-run                 Показать команду и пути, ничего не собирать
  --no-base-omit            Не добавлять базовые исключения
  --no-color                Отключить цвета в выводе
  -s, --search <ТЕКСТ>      Только файлы, содержащие текст (можно несколько)
  -o, --omit <ПОДСТРОКА>    Исключить пути (можно несколько)
  -n, --name-only           Только список путей
  -m, --minimalize          Убрать отступы и пустые строки (экономия токенов)
  --hash-sum                Добавить md5 набора файлов
  -h, --help                Показать эту справку и выйти

${ansi.paint('Цели:', b)} короткое имя или путь. Резолвится по порядку:
    явный путь -> apps/<имя> -> packages/<имя>
Доступные короткие имена: ${ansi.paint(getAvailableTargets().join(", ") || "—", c)}

${ansi.paint('Примеры:', b)}
    bun run snapshot:code -- client
    bun run snapshot:code -- client packages/ui -m
    bun run snapshot:code -- --global --hash-sum
    bun run snapshot:code -- backend -s useState -n

${ansi.paint('Базовые омиты:', b)}
    ${BASE_OMITS.join(", ")}
`);
}

async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            help: { type: "boolean", short: "h" },
            global: { type: "boolean" },
            out: { type: "string" },
            stdout: { type: "boolean" },
            "dry-run": { type: "boolean" },
            "no-base-omit": { type: "boolean" },
            "no-color": { type: "boolean" },
            search: { type: "string", multiple: true, short: "s" },
            omit: { type: "string", multiple: true, short: "o" },
            "name-only": { type: "boolean", short: "n" },
            minimalize: { type: "boolean", short: "m" },
            "hash-sum": { type: "boolean" },
        },
        allowPositionals: true,
    });

    if (values["no-color"]) ansi.disable();

    if (values.help) {
        printHelp();
        process.exit(0);
    }

    const kind = positionals[0] || "code";
    const rawTargets = positionals.slice(1);

    if (values.global && rawTargets.length > 0) {
        console.error(`${ansi.paint("Ошибка:", ansi.Style.RED)} --global не сочетается с целями.`);
        process.exit(1);
    }

    let targetPaths: string[] = [];

    try {
        if (values.global || rawTargets.length === 0) {
            targetPaths = [REPO_ROOT, DEV_DIR].filter(p => fs.existsSync(p));
        } else {
            targetPaths = rawTargets.map(resolveTarget);
        }
    } catch (e: any) {
        console.error(`${ansi.paint("Ошибка:", ansi.Style.RED)} ${e.message}`);
        console.error(`Доступные: ${getAvailableTargets().join(", ")}`);
        process.exit(1);
    }

    // Формируем имя файла
    const slugify = (text: string) => text.replace(/[^0-9A-Za-zЀ-ӿ._+-]+/g, "-").replace(/^-+|-+$/g, "");
    let outFileName = values.out;
    if (!outFileName) {
        outFileName = rawTargets.length === 0 ? "global.md" : `${rawTargets.map((t: string) => slugify(path.basename(t))).join("+")}.md`;
    }
    const outPath = path.join(OUT_DIR, outFileName);

    // Настраиваем OMIT
    const omits = values.omit || [];
    if (!values["no-base-omit"]) Object.assign(omits, [...omits, ...BASE_OMITS]);
    omits.push(`${rel(OUT_DIR)}/`); // Исключаем саму папку со снапшотами

    if (values["dry-run"]) {
        console.log(`${ansi.paint("Файл:", ansi.Style.BOLD)}    ${rel(outPath)}`);
        console.log(`${ansi.paint("Цели:", ansi.Style.BOLD)}    ${targetPaths.map(rel).join(", ")}`);
        return;
    }

    // Подготавливаем заголовок
    const dateStr = new Date().toISOString().split(".")[0];
    const targetsDesc = rawTargets.length === 0 ? "весь проект" : targetPaths.map(rel).join(", ");
    const rev = getGitRevision();

    let md = `# Снапшот: ${kind}\n\n- Цели: ${targetsDesc}\n- Дата: ${dateStr}\n`;
    if (rev) md += `- Ревизия: ${rev}\n`;
    md += `\n---\n\n`;

    // Записываем файлы
    const options: PrintallOptions = {
        search: values.search || [],
        omit: omits,
        nameOnly: values["name-only"] || false,
        minimalize: values.minimalize || false,
        hashSum: values["hash-sum"] || false,
    };

    const entries: FileEntry[] = [];

    for await (const entry of getFileEntries(targetPaths, options)) {
        entries.push(entry);
        if (options.nameOnly) {
            if (entry.isText) md += `${rel(entry.path)}\n`;
        } else {
            // Передаем относительный путь для красивых заголовков в markdown (rel(entry.path))
            md += formatFileContent(entry, options.minimalize, rel(entry.path));
        }
    }

    if (options.hashSum) {
        const { md5, count } = calculateHash(entries);
        md += `## Контрольная сумма\n\nhash-sum: md5=${md5} files=${count}\n`;
        console.error(`${ansi.paint("Контрольная сумма:", ansi.Style.BOLD)} md5=${md5} (файлов: ${count})`);
    }

    // Сохранение
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, md, "utf-8");

    const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.error(`${ansi.paint("Снапшот сохранён:", ansi.Style.GREEN)} ${rel(outPath)} (${sizeKb} КБ)`);

    if (values.stdout) {
        console.log(md);
    }
}

main().catch(e => {
    console.error(ansi.paint("Критическая ошибка:", ansi.Style.RED), e);
    process.exit(1);
});