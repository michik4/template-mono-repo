# Конструктор линтера

В некоторых ситуациях требуется кастомный статический анализ кода перед запуском кода в прод (см. пример [route-conflict](../../../apps/backend/lint/rules/route-conflict.ts) проверку для NestJS)

## Использование

> Пакет `@repo/shared/lint` также экспортирует `ts-morph`, чтобы исключить доп. зависимости. Документацию `ts-morph` см. [здесь](https://ts-morph.com/). 
> Чтобы понять как выглядит AST и какие методы `ts-morph` использовать, можете воспользоваться [ts-ast-viewer](https://ts-ast-viewer.com/#)

интерфейс `LintIssue`:
```ts
interface LintIssue {
    ruleId: string;
    severity: LintSeverity; // 'error' | 'warning'
    filePath: string;
    line: number;
    message: string;
    hint?: string;
}
```

Это формат `issue`

---

Базовый класс `BaseLinter` имеет абстрактный метод 
`run(project: Project): LintIssue[] | Promise<LintIssue[]>` (может быть асинхронным) и поле `readonly ruleId: string`.

В будущем метод `run()` будет использоваться для запуска при вызове линтера

```ts
// lint/rules/example.ts
// создание правила (линтера)

export class ExampleLinter extends BaseLinter {
    readonly ruleId = 'sr4/example-rule';

    run(project: Project): LintIssue[] {
        const issues: LintIssue[] = [];

        // Проверки ...

        issues.push({
            ruleId: this.ruleId,
            severity: 'error',
            filePath: 'apps/example-app/main.ts',
            line: 1,
            message: 'Какое-то недопустимое использование или паттерн',
            hint: 'Подсказка для исправления'
        })

        return issues;
    }
}
```

После все правила нужно собрать в общий ранер:

```ts
// lint/index.ts

runLinters({
    linters: [
        new ExampleLinter(),
        /* ... др. линтеры */
    ],
    tsConfigFilePath: /* <string> Путь до tsconfig.json для бесшовной работы ESLint */,
    eslintTarget: /* <string> таргет ESLint */
}).catch((err) => {
    console.error(err);
    process.exit(1);
})
```

Позже можно запустить `index.ts` в качестве скрипта 

```json
{
    "scripts": {
        "lint": "bun ./lint/index.ts"
    }
}
```

## Вывод

Пример вывода [route-conflict](../../../apps/backend/lint/rules/route-conflict.ts)

```log
$ bun ./lint/index.ts
> Запуск единого конвейера линтинга (ESLint + Custom Rules)...

src/app.controller.ts
  16:0  error   Параметризированный роут @Get(':id') в методе test2() никогда не будет вызван. Он перекрыт роутом @Get('*') из метода test1() на строке 13.  nestjs/route-conflict
  hint: Роуты должны располагаться от самых точных к самым общим. Wildcard-роуты ('*') должны быть в самом конце, а параметризированные (':id') — строго ниже статических ('me').

✖ 1 проблем (1 ошибок, 0 предупреждений)

error: script "lint" exited with code 1
```

Вместе со стандартным ESLint:

```log
$ bun ./lint/index.ts
> Запуск единого конвейера линтинга (ESLint + Custom Rules)...

src/main.ts
  8:0  warning Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator.  @typescript-eslint/no-floating-promises

src/app.controller.ts
  16:0  error   Параметризированный роут @Get(':id') в методе test2() никогда не будет вызван. Он перекрыт роутом @Get('*') из метода test1() на строке 13.  nestjs/route-conflict
  hint: Роуты должны располагаться от самых точных к самым общим. Wildcard-роуты ('*') должны быть в самом конце, а параметризированные (':id') — строго ниже статических ('me').

✖ 2 проблем (1 ошибок, 1 предупреждений)

error: script "lint" exited with code 1
```