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

test('audit reports semantic duplicates with renamed and reordered operations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-duplicate-code-'));
	try {
		await writeFile(join(root, 'score.ts'), semanticFixture('scoreJob', 'amount'));
		await writeFile(join(root, 'rank.ts'), reorderedSemanticFixture('rankTask', 'input'));

		const findings = await auditPath(root);
		const duplicateFinding = findings.find((finding) => finding.rule === 'duplicated-code');

		expect(['rank.ts', 'score.ts']).toContain(duplicateFinding?.path);
		expect(duplicateFinding?.message).toContain('semantically duplicates');
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

function semanticFixture(name: string, parameter: string): string {
	return `${[
		`export function ${name}(${parameter}: number): number {`,
		`\tconst baseline = ${parameter} + 10;`,
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

function reorderedSemanticFixture(name: string, parameter: string): string {
	return `${[
		`export function ${name}(${parameter}: number): number {`,
		`\tconst start = ${parameter} + 15;`,
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

function shortFixture(name: string): string {
	return `${[
		`export function ${name}(value: number): number {`,
		'\tconst doubled = value * 2;',
		'\treturn doubled;',
		'}'
	].join('\n')}\n`;
}
