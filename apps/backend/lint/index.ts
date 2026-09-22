// apps/backend/lint/index.ts
import path from 'node:path';
import { MaxLinesLinter, runLinters } from '@sr4/shared/lint';
import { RouteConflictLinter } from './rules/route-conflict';

runLinters({
    linters: [
        new RouteConflictLinter(),
        new MaxLinesLinter(250)
    ],
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
    eslintTarget: '{src,test}/**/*.ts'
}).catch((err) => {
    console.error(err);
    process.exit(1);
});