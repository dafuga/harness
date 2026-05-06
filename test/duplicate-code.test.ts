import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';

test('audit reports duplicated meaningful code blocks', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-duplicate-code-'));
	try {
		await writeFile(join(root, 'first.ts'), duplicateFixture('firstThing'));
		await writeFile(join(root, 'second.ts'), duplicateFixture('secondThing'));

		const findings = await auditPath(root);
		const duplicateFinding = findings.find((finding) => finding.rule === 'duplicated-code');

		expect(duplicateFinding?.path).toBe('second.ts');
		expect(duplicateFinding?.message).toContain('first.ts');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('audit ignores short repeated code snippets', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-duplicate-code-'));
	try {
		await writeFile(join(root, 'first.ts'), shortFixture('firstThing'));
		await writeFile(join(root, 'second.ts'), shortFixture('secondThing'));

		const findings = await auditPath(root);

		expect(findings.some((finding) => finding.rule === 'duplicated-code')).toBe(false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

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

function shortFixture(name: string): string {
	return `${[
		`export function ${name}(value: number): number {`,
		'\tconst doubled = value * 2;',
		'\treturn doubled;',
		'}'
	].join('\n')}\n`;
}
