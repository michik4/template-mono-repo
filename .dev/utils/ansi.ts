// Файл: .dev/utils/ansi.ts
export const Style = {
    RESET: "\x1b[0m",
    BOLD: "\x1b[1m",
    DIM: "\x1b[2m",
    RED: "\x1b[31m",
    GREEN: "\x1b[32m",
    YELLOW: "\x1b[33m",
    BLUE: "\x1b[34m",
    MAGENTA: "\x1b[35m",
    CYAN: "\x1b[36m",
};

// Проверяем, поддерживает ли терминал цвета (стандартные проверки Node/Bun)
export let ENABLED =
    process.stdout.isTTY &&
    !process.env.NO_COLOR &&
    process.env.TERM !== "dumb";

export function disable() {
    ENABLED = false;
}

export function paint(text: string, style: string): string {
    if (!ENABLED || !style) return text;
    return `${style}${text}${Style.RESET}`;
}