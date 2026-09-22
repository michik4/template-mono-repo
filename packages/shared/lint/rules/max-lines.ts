import type { Project } from 'ts-morph';
import { BaseLinter, type LintIssue } from '../base-linter.types';

export class MaxLinesLinter extends BaseLinter {
    readonly ruleId = 'global/max-lines';

    // Передаем лимит в конструктор (по умолчанию 300 строк)
    constructor(private maxLines: number = 300) {
        super();
    }

    run(project: Project): LintIssue[] {
        const issues: LintIssue[] = [];

        // Проходим по всем файлам, которые ts-morph распарсил для текущего проекта
        for (const sourceFile of project.getSourceFiles()) {
            const linesCount = sourceFile.getEndLineNumber();

            if (linesCount > this.maxLines) {
                issues.push({
                    ruleId: this.ruleId,
                    severity: 'error', // Для начала лучше 'warning', чтобы не сломать CI
                    filePath: sourceFile.getFilePath(),
                    line: linesCount, // Укажем общее кол-во строк как место ошибки
                    message: `Файл слишком большой: ${linesCount} строк (разрешено не более ${this.maxLines}).`,
                    hint: 'Разбейте файл на более мелкие модули (вынесите типы, константы или вспомогательные функции).',
                });
            }
        }

        return issues;
    }
}