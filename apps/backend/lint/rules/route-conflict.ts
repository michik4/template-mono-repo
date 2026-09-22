import { BaseLinter, LintIssue } from '@repo/shared/lint';
import { ClassDeclaration, Node, type Project } from '@repo/shared/lint';

const HTTP_METHODS = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head', 'All'];

interface RouteInfo {
    httpMethod: string;
    path: string;
    methodName: string;
    line: number;
    regex: RegExp;
}

export class RouteConflictLinter extends BaseLinter {
    readonly ruleId = 'nestjs/route-conflict';

    private createRouteRegex(route: string): RegExp {
        const normalized = route.replace(/^\/+/, '').replace(/\/+$/, '');
        let escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        escaped = escaped.replace(/:[a-zA-Z0-9_]+/g, '[^/]+');
        escaped = escaped.replace(/\*/g, '.*');
        return new RegExp(`^${escaped}$`);
    }

    private extractPaths(decorator: Node): string[] {
        // @ts-ignore
        const args = decorator.getArguments();
        if (args.length === 0) return [''];

        const arg = args[0];
        if (Node.isStringLiteral(arg) || Node.isNoSubstitutionTemplateLiteral(arg)) {
            return [arg.getLiteralValue()];
        }

        if (Node.isArrayLiteralExpression(arg)) {
            return arg.getElements()
                .filter((e) => Node.isStringLiteral(e) || Node.isNoSubstitutionTemplateLiteral(e))
                .map((e: any) => e.getLiteralValue());
        }

        return [''];
    }

    private analyzeController(classDecl: ClassDeclaration, filePath: string): LintIssue[] {
        const issues: LintIssue[] = [];
        const seenRoutes: RouteInfo[] = [];

        for (const method of classDecl.getMethods()) {
            for (const decorator of method.getDecorators()) {
                const decName = decorator.getName();
                if (!HTTP_METHODS.includes(decName)) continue;

                const paths = this.extractPaths(decorator);
                const lineNumber = method.getStartLineNumber();

                for (const routePath of paths) {
                    const normalizedPath = routePath.replace(/^\/+/, '').replace(/\/+$/, '');
                    const shadow = seenRoutes.find(
                        (seen) => seen.httpMethod === decName && seen.regex.test(normalizedPath)
                    );

                    if (shadow) {
                        // Определяем тип текущего роута для красивого сообщения
                        let routeType = 'Статический роут';
                        if (routePath.includes('*')) {
                            routeType = 'Wildcard-роут';
                        } else if (routePath.includes(':')) {
                            routeType = 'Параметризированный роут';
                        }

                        issues.push({
                            ruleId: this.ruleId,
                            severity: 'error',
                            filePath,
                            line: lineNumber,
                            message: `${routeType} @${decName}('${routePath}') в методе ${method.getName()}() никогда не будет вызван. Он перекрыт роутом @${shadow.httpMethod}('${shadow.path}') из метода ${shadow.methodName}() на строке ${shadow.line}.`,
                            hint: 'Роуты должны располагаться от самых точных к самым общим. Wildcard-роуты (\'*\') должны быть в самом конце, а параметризированные (\':id\') — строго ниже статических (\'me\').',
                        });
                    }

                    seenRoutes.push({
                        httpMethod: decName,
                        path: routePath,
                        methodName: method.getName(),
                        line: lineNumber,
                        regex: this.createRouteRegex(routePath),
                    });
                }
            }
        }

        return issues;
    }

    run(project: Project): LintIssue[] {
        const issues: LintIssue[] = [];

        // Ищем все контроллеры в проекте
        const sourceFiles = project.getSourceFiles('**/*.controller.ts');

        for (const sourceFile of sourceFiles) {
            for (const classDecl of sourceFile.getClasses()) {
                const hasControllerDecorator = classDecl.getDecorators().some(d => d.getName() === 'Controller');
                if (hasControllerDecorator) {
                    issues.push(...this.analyzeController(classDecl, sourceFile.getFilePath()));
                }
            }
        }

        return issues;
    }
}