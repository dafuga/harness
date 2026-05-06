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
		await writeFile(join(project, 'src/second-copy.ts'), semanticVariantFixture('secondCopy'));

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

function semanticVariantFixture(name: string): string {
	return `${[
		`export function ${name}(input: number): number {`,
		'\tconst start = input + 15;',
		'\tconst multiplied = start * 2;',
		'\tconst moved = multiplied - 7;',
		'\tconst guarded = Math.max(moved, 0);',
		'\tconst integer = Math.round(guarded);',
		'\tconst aggregate = integer + start;',
		'\tconst capped = Math.min(aggregate, 100);',
		'\tconst inflated = capped + integer;',
		'\tconst reduced = inflated - start;',
		'\tconst winner = Math.max(reduced, 1);',
		'\tconst visible = winner + aggregate;',
		'\tconst answer = Math.min(visible, 200);',
		'\treturn answer;',
		'}'
	].join('\n')}\n`;
}
