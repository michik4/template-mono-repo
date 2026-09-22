// packages/shared/lint/runner.ts
import { Project } from 'ts-morph';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { BaseLinter, LintIssue } from './base-linter.types';

const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

export interface RunnerOptions {
    linters: BaseLinter[];
    tsConfigFilePath: string;
    eslintTarget: string;
}

export async function runLinters({ linters, tsConfigFilePath, eslintTarget }: RunnerOptions) {
    console.log(`${colors.cyan}> Запуск единого конвейера линтинга (ESLint + Custom Rules)...${colors.reset}\n`);

    const allIssues: LintIssue[] = [];

    // 1. Запуск ESLint
    const eslintResult = spawnSync(
        'bunx',
        ['eslint', eslintTarget, '--fix', '--format', 'json'],
        { encoding: 'utf-8', cwd: process.cwd() } // Выполняем в папке приложения!
    );

    if (eslintResult.stdout) {
        try {
            const eslintData = JSON.parse(eslintResult.stdout);
            for (const fileResult of eslintData) {
                for (const msg of fileResult.messages) {
                    allIssues.push({
                        ruleId: msg.ruleId || 'eslint-error',
                        severity: msg.severity === 2 ? 'error' : 'warning',
                        filePath: fileResult.filePath,
                        line: msg.line || 0,
                        message: msg.message,
                    });
                }
            }
        } catch (e) {
            console.error(`${colors.yellow}⚠️ Не удалось распарсить вывод ESLint. Оригинальный лог:${colors.reset}`);
            console.log(eslintResult.stdout || eslintResult.stderr);
        }
    }

    // 2. Запуск кастомных правил (если они переданы)
    if (linters.length > 0) {
        const project = new Project({ tsConfigFilePath });

        for (const linter of linters) {
            const issues = await linter.run(project);
            allIssues.push(...issues);
        }
    }

    // 3. Вывод результатов
    if (allIssues.length === 0) {
        console.log(`${colors.bold}${colors.cyan}Ошибок не найдено. Код соответствует всем стандартам проекта.${colors.reset}`);
        process.exit(0);
    }

    const groupedByFile = allIssues.reduce((acc, issue) => {
        const relPath = path.relative(process.cwd(), issue.filePath);
        if (!acc[relPath]) acc[relPath] = [];
        acc[relPath].push(issue);
        return acc;
    }, {} as Record<string, LintIssue[]>);

    let errorCount = 0;
    let warningCount = 0;

    for (const [file, issues] of Object.entries(groupedByFile)) {
        console.log(`${colors.bold}${file}${colors.reset}`);
        issues.sort((a, b) => a.line - b.line);

        // Вычисляем максимальную ширину блока "строка:колонка" для выравнивания таблицы
        const maxLineLen = issues.reduce((max, issue) => Math.max(max, `${issue.line}:0`.length), 0);

        for (const issue of issues) {
            if (issue.severity === 'error') errorCount++;
            if (issue.severity === 'warning') warningCount++;

            const severityColor = issue.severity === 'error' ? colors.red : colors.yellow;

            // Форматируем строку с номером линии, дополняя её пробелами справа
            const lineStr = `${issue.line}:0`.padEnd(maxLineLen);

            console.log(`  ${colors.dim}${lineStr}${colors.reset}  ${severityColor}${issue.severity.padEnd(7)}${colors.reset} ${issue.message}  ${colors.dim}${issue.ruleId}${colors.reset}`);

            if (issue.hint) {
                // Пустое пространство под блоком номера строки
                const emptyLine = ' '.repeat(maxLineLen);
                console.log(`  ${emptyLine}  ${colors.cyan}${'hint'.padEnd(7)}${colors.reset} ${issue.hint}`);
            }
        }
        console.log('');
    }

    const totalColor = errorCount > 0 ? colors.red : colors.yellow;
    console.log(`${colors.bold}${totalColor}✖ ${errorCount + warningCount} проблем (${errorCount} ошибок, ${warningCount} предупреждений)${colors.reset}\n`);

    if (errorCount > 0) process.exit(1);
}