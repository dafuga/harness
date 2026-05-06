import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { commandOutput, runHarness } from './support/cli';

test('generated projects reject duplicated code through Harness audit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-duplicate-code-'));
	try {
		await runHarness(['new', 'lib', 'duplicate-code'], root);
		const project = join(root, 'duplicate-code');

		await writeFile(join(project, 'src/first-copy.ts'), duplicateFixture('firstCopy'));
		await writeFile(join(project, 'src/second-copy.ts'), duplicateFixture('secondCopy'));

		const auditFailure = await runHarness(['audit', '.'], project, false);

		expect(auditFailure.exitCode).toBe(1);
		expect(commandOutput(auditFailure)).toContain('duplicated-code');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

function duplicateFixture(name: string): string {
	return `${[
		`export function ${name}(value: number): number {`,
		'\tconst baseline = value + 10;',
		'\tconst doubled = baseline * 2;',
		'\tconst shifted = doubled - 3;',
		'\tconst bounded = Math.max(shifted, 0);',
		'\tconst rounded = Math.round(bounded);',
		'\tconst weighted = rounded + baseline;',
		'\tconst limited = Math.min(weighted, 100);',
		'\tconst expanded = limited + rounded;',
		'\tconst adjusted = expanded - baseline;',
		'\tconst finalValue = Math.max(adjusted, 1);',
		'\tconst displayValue = finalValue + weighted;',
		'\tconst safeValue = Math.min(displayValue, 200);',
		'\treturn safeValue;',
		'}'
	].join('\n')}\n`;
}
