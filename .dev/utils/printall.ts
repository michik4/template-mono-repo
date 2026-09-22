// Файл: .dev/utils/printall.ts
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

export interface PrintallOptions {
    search: string[];
    omit: string[];
    nameOnly: boolean;
    minimalize: boolean;
    hashSum: boolean;
}

export interface FileEntry {
    path: string;
    isText: boolean;
    explicit: boolean;
}

function isTextFile(filepath: string): boolean {
    try {
        const stat = fs.statSync(filepath);
        if (stat.size === 0) return true;

        const fd = fs.openSync(filepath, "r");
        const buffer = Buffer.alloc(1024);
        const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
        fs.closeSync(fd);

        return !buffer.subarray(0, bytesRead).includes(0);
    } catch {
        return false;
    }
}

function isWhitespaceSensitive(filepath: string): boolean {
    const name = path.basename(filepath).toLowerCase();
    if (name === "makefile") return true;

    const sensitiveExts = [
        ".py", ".yaml", ".yml", ".md", ".markdown",
        ".coffee", ".pug", ".jade", ".nim", ".f90",
    ];
    if (sensitiveExts.some((ext) => name.endsWith(ext))) return true;

    try {
        const fd = fs.openSync(filepath, "r");
        const buffer = Buffer.alloc(256);
        fs.readSync(fd, buffer, 0, 256, 0);
        fs.closeSync(fd);

        const firstLine = buffer.toString("utf-8").split("\n")[0].trim();
        if (
            firstLine.startsWith("#!") &&
            ["python", "coffee", "nim"].some((lang) => firstLine.toLowerCase().includes(lang))
        ) {
            return true;
        }
    } catch { }

    return false;
}

function matchesSearch(filepath: string, terms: string[]): boolean {
    if (terms.length === 0) return true;
    const name = path.basename(filepath);
    if (terms.some((t) => name.includes(t))) return true;

    try {
        const content = fs.readFileSync(filepath, "utf-8");
        return terms.some((t) => content.includes(t));
    } catch {
        return false;
    }
}

function getExt(filepath: string): string {
    const name = path.basename(filepath);
    const lower = name.toLowerCase();
    let ext = path.extname(filepath).replace(".", "");

    if (lower === "dockerfile") ext = "dockerfile";
    else if (lower === "makefile") ext = "makefile";
    else if (lower === "jenkinsfile") ext = "groovy";
    else if (name === "Cargo.toml") ext = "toml";
    else if (name === "go.mod" || name === "go.sum") ext = "go";
    else if (!ext && isWhitespaceSensitive(filepath)) ext = "python";

    return ext;
}

async function* walk(dir: string, omits: string[]): AsyncGenerator<string> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;

        const fullPath = path.join(dir, entry.name);
        const normalizedPath = fullPath.replaceAll("\\", "/");

        if (omits.some((o) => normalizedPath.includes(o))) continue;

        if (entry.isDirectory()) {
            yield* walk(fullPath, omits);
        } else {
            yield fullPath;
        }
    }
}

export async function* getFileEntries(
    targetPaths: string[],
    options: PrintallOptions
): AsyncGenerator<FileEntry> {
    const processed = new Set<string>();

    for (const target of targetPaths) {
        if (!fs.existsSync(target)) {
            console.error(`Ошибка: '${target}' не найден.`);
            continue;
        }

        const stat = fs.statSync(target);
        if (stat.isFile()) {
            processed.add(target);
            yield { path: target, isText: isTextFile(target), explicit: true };
        } else if (stat.isDirectory()) {
            for await (const filepath of walk(target, options.omit)) {
                if (processed.has(filepath)) continue;
                processed.add(filepath);

                const isText = isTextFile(filepath);
                if (isText && options.search.length > 0 && !matchesSearch(filepath, options.search)) {
                    continue;
                }

                yield { path: filepath, isText, explicit: false };
            }
        }
    }
}

export function formatFileContent(entry: FileEntry, minimalize: boolean, displayPath: string): string {
    const normalizedPath = displayPath.replaceAll("\\", "/");
    let header = `## Файл: ${normalizedPath}\n\n`;

    if (!entry.isText) {
        return `> **Пропущен бинарный файл:** ${normalizedPath}\n\n`;
    }

    const ext = getExt(entry.path);
    header += `\`\`\`${ext}\n`;

    try {
        let content = fs.readFileSync(entry.path, "utf-8");

        if (minimalize && !isWhitespaceSensitive(entry.path)) {
            content = content
                .split("\n")
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .join("\n");
        }

        if (content && !content.endsWith("\n")) content += "\n";
        return header + content + `\`\`\`\n\n`;
    } catch (e) {
        return header + `[Ошибка чтения файла: ${e}]\n\`\`\`\n\n`;
    }
}

export function calculateHash(entries: FileEntry[]): { md5: string; count: number } {
    const hash = createHash("md5");
    let count = 0;

    const validEntries = entries.filter((e) => e.isText).sort((a, b) => a.path.localeCompare(b.path));

    for (const entry of validEntries) {
        try {
            const content = fs.readFileSync(entry.path, "utf-8");
            const normalizedPath = entry.path.replaceAll("\\", "/");
            const normalizedContent = content.replace(/\r\n/g, "\n");

            hash.update(normalizedPath, "utf-8");
            hash.update(Buffer.from([0]));
            hash.update(normalizedContent, "utf-8");
            hash.update(Buffer.from([0]));
            count++;
        } catch {
            continue;
        }
    }

    return { md5: hash.digest("hex"), count };
}

// ============================================================================
// CLI-интерфейс (выполняется только если запустить скрипт напрямую через bun)
// ============================================================================
if (import.meta.main) {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            help: { type: "boolean", short: "h" },
            search: { type: "string", multiple: true, short: "s" },
            omit: { type: "string", multiple: true, short: "o" },
            "name-only": { type: "boolean", short: "n" },
            minimalize: { type: "boolean", short: "m" },
            "hash-sum": { type: "boolean" },
        },
        allowPositionals: true,
    });

    if (values.help) {
        console.log(`
Выводит файлы в MD формате (в кодовых скобках). 
C помощью этой утилиты можно удобно формировать контекст для LLM.

Опции:
  -s, --search <текст>      Только файлы, содержащие текст (можно несколько)
  -o, --omit <подстрока>    Исключить пути, содержащие подстроку (можно несколько)
  -n, --name-only           Только список путей, без содержимого
  -m, --minimalize          Убрать отступы и пустые строки (экономия токенов)
      --hash-sum            Контрольная сумма (md5) набора файлов
  -h, --help                Показать эту справку и выйти

Использование:
  bun .dev/utils/printall.ts [пути...]
  
!!! БУДЬТЕ ОСТОРОЖНЫ С ИСПОЛЬЗОВАНИЕМ БЕЗ ПАРАМЕТРОВ !!!
рекурсивно выведет все файлы в текущей директории, включая папки сборки, node_modules и прочее
`);
        process.exit(0);
    }

    const paths = positionals.length > 0 ? positionals : ["."];
    const options: PrintallOptions = {
        search: values.search || [],
        omit: values.omit || [],
        nameOnly: values["name-only"] || false,
        minimalize: values.minimalize || false,
        hashSum: values["hash-sum"] || false,
    };

    (async () => {
        const entries: FileEntry[] = [];
        for await (const entry of getFileEntries(paths, options)) {
            entries.push(entry);

            if (options.nameOnly) {
                if (entry.isText) console.log(entry.path);
            } else {
                // При прямом вызове выводим с оригинальным путем и сразу в stdout
                const announce = !options.nameOnly && entry.explicit ? true : !(options.search.length > 0 || options.nameOnly);
                if (entry.isText || announce) {
                    process.stdout.write(formatFileContent(entry, options.minimalize, entry.path));
                }
            }
        }

        if (options.hashSum) {
            const { md5, count } = calculateHash(entries);
            console.log(`## Контрольная сумма\n\nhash-sum: md5=${md5} files=${count}\n`);
        }
    })();
}