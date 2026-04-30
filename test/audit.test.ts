import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';

const ruleFixtures: Record<string, string> = {
	'small-class': [
		'export class BigClass {',
		...Array.from({ length: 121 }, (_, index) => `\tvalue${index} = ${index};`),
		'}'
	].join('\n'),
	'method-length': [
		'export class BigMethod {',
		'\trun(): void {',
		...Array.from({ length: 36 }, () => '\t\tvoid 1;'),
		'\t}',
		'}'
	].join('\n'),
	'max-complexity': [
		'export function branchy(): void {',
		...Array.from({ length: 11 }, (_, index) => `\tif (${index} > -1) void ${index};`),
		'}'
	].join('\n'),
	'max-nesting':
		'export function nested(): void {\n\tif (true) {\n\t\tif (true) {\n\t\t\tif (true) {\n\t\t\t\tif (true) {\n\t\t\t\t\tif (true) {\n\t\t\t\t\t\tvoid 1;\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}\n',
	'max-parameters':
		'export function tooMany(a: string, b: string, c: string, d: string, e: string): string {\n\treturn a + b + c + d + e;\n}\n',
	'max-classes-per-file':
		"export class FirstThing {\n\tvalue = 'first';\n}\n\nexport class SecondThing {\n\tvalue = 'second';\n}\n",
	'no-manager-name':
		"export class ReportManager {\n\trun(): string {\n\t\treturn 'report';\n\t}\n}\n"
};

test('audit reports oversized files', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	const longFile = Array.from(
		{ length: 225 },
		(_, index) => `export const value${index} = ${index};`
	);

	await writeFile(join(root, 'large.ts'), longFile.join('\n'));

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-file')).toBe(true);
	await rm(root, { recursive: true, force: true });
});

test('audit reports oversized functions and ignores build folders', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	const longFunction = [
		'export function tooLong(): number {',
		...Array.from({ length: 56 }, (_, index) => `\tconst value${index} = ${index};`),
		'\treturn 1;',
		'}'
	];

	await writeFile(join(root, 'large-function.ts'), longFunction.join('\n'));
	await mkdir(join(root, 'node_modules'));
	await writeFile(join(root, 'node_modules', 'ignored.ts'), longFunction.join('\n'));

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-function')).toBe(true);
	expect(findings.some((finding) => finding.path.includes('node_modules'))).toBe(false);
	await rm(root, { recursive: true, force: true });
});

test('audit reports class, method, complexity, nesting, parameter, count, and naming rules', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));

	for (const [rule, contents] of Object.entries(ruleFixtures)) {
		await writeFile(join(root, `${rule}.ts`), contents);
	}

	const findings = await auditPath(root);
	const rules = new Set(findings.map((finding) => finding.rule));

	for (const rule of Object.keys(ruleFixtures)) {
		expect(rules.has(rule), rule).toBe(true);
	}

	await rm(root, { recursive: true, force: true });
});

test('audit reports architecture rule violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	await mkdir(join(root, 'src/core'), { recursive: true });
	await mkdir(join(root, 'src/commands'), { recursive: true });
	await writeFile(
		join(root, 'src/core/bad.ts'),
		"import { projectFiles } from '../templates/project';\n"
	);
	await writeFile(
		join(root, 'src/commands/bad.ts'),
		"import { projectFiles } from '../templates/project';\n"
	);

	const findings = await auditPath(root);
	const rules = findings.map((finding) => finding.rule);

	expect(rules).toContain('architecture-boundaries');
	expect(rules).toContain('thin-command-modules');
	await rm(root, { recursive: true, force: true });
});
