import type { Project } from 'ts-morph';

export type LintSeverity = 'error' | 'warning';

export interface LintIssue {
    ruleId: string;
    severity: LintSeverity;
    filePath: string;
    line: number;
    message: string;
    hint?: string;
}

export abstract class BaseLinter {
    abstract readonly ruleId: string;
    abstract run(project: Project): LintIssue[] | Promise<LintIssue[]>;
}