import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { commandOutput, runCommand, runHarness } from './support/cli';

test('generated projects reject bad code through lint, check, and Harness audit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-bad-rules-'));
	try {
		await runHarness(['new', 'lib', 'bad-rules'], root);
		const project = join(root, 'bad-rules');

		await writeBadRuleFixtures(project);
		await runCommand(['bun', 'install'], project);
		await runCommand(['bun', 'run', 'format'], project);

		const lintFailure = await runCommand(['bun', 'run', 'lint'], project, false);
		expect(lintFailure.exitCode).toBe(1);
		expectLintRules(commandOutput(lintFailure), lintRuleIds);

		const checkFailure = await runCommand(['bun', 'run', 'check'], project, false);
		expect(checkFailure.exitCode).toBe(1);
		expect(commandOutput(checkFailure)).toContain('harness/max-class-lines');

		const auditFailure = await runHarness(['audit', '.'], project, false);
		expect(auditFailure.exitCode).toBe(1);
		expectRules(commandOutput(auditFailure), auditRuleIds);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

const lintRuleIds = [
	'max-lines',
	'max-lines-per-function',
	'harness/max-class-lines',
	'harness/max-method-lines',
	'max-classes-per-file',
	'harness/no-manager-name',
	'complexity',
	'max-depth',
	'max-params',
	'no-nested-ternary'
];

const auditRuleIds = [
	'small-file',
	'small-function',
	'small-class',
	'method-length',
	'max-classes-per-file',
	'no-manager-name',
	'max-complexity',
	'max-nesting',
	'max-parameters',
	'file-name-pattern',
	'function-name-pattern',
	'architecture-boundaries'
];

function expectLintRules(output: string, rules: string[]): void {
	for (const rule of rules) {
		expect(output, rule).toMatch(new RegExp(`(?:^|\\s)${escapeRegExp(rule)}(?:\\s|$)`));
	}
}

async function writeBadRuleFixtures(project: string): Promise<void> {
	await mkdir(join(project, 'src/core'), { recursive: true });
	await mkdir(join(project, 'src/services'), { recursive: true });
	await mkdir(join(project, 'src/templates'), { recursive: true });
	await mkdir(join(project, 'src/utils'), { recursive: true });

	await writeFile(join(project, 'src/long-file.ts'), longFileFixture());
	await writeFile(join(project, 'src/long-function.ts'), longFunctionFixture());
	await writeFile(join(project, 'src/utils/bad-name.ts'), badFunctionNameFixture());
	await writeFile(join(project, 'src/branchy.ts'), branchyFixture());
	await writeFile(join(project, 'src/nested.ts'), nestedFixture());
	await writeFile(join(project, 'src/too-many.ts'), tooManyFixture());
	await writeFile(join(project, 'src/nested-ternary.ts'), nestedTernaryFixture());
	await writeFile(join(project, 'src/services/BigClassManager.ts'), bigClassFixture());
	await writeFile(join(project, 'src/services/post-service.ts'), badFileNameFixture());
	await writeFile(join(project, 'src/services/BigMethod.ts'), bigMethodFixture());
	await writeFile(join(project, 'src/services/ManyClasses.ts'), manyClassesFixture());
	await writeFile(
		join(project, 'src/templates/project.ts'),
		"export const templateName = 'bad';\n"
	);
	await writeFile(
		join(project, 'src/core/badBoundary.ts'),
		"import { templateName } from '../templates/project';\n\nexport const boundaryName = templateName;\n"
	);
}

function expectRules(output: string, rules: string[]): void {
	for (const rule of rules) {
		expect(output, rule).toContain(rule);
	}
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function longFileFixture(): string {
	return (
		Array.from({ length: 225 }, (_, index) => `export const value${index} = ${index};`).join('\n') +
		'\n'
	);
}

function longFunctionFixture(): string {
	return `${[
		'export function tooLong(): void {',
		...Array.from({ length: 56 }, () => '\tvoid 1;'),
		'}'
	].join('\n')}\n`;
}

function badFunctionNameFixture(): string {
	return 'export function bad_name(value: string): string {\n\treturn value;\n}\n';
}

function badFileNameFixture(): string {
	return "export class PostService {\n\trun(): string {\n\t\treturn 'post';\n\t}\n}\n";
}

function bigClassFixture(): string {
	return `${[
		'export class BigClassManager {',
		...Array.from({ length: 121 }, (_, index) => `\tvalue${index} = ${index};`),
		'}'
	].join('\n')}\n`;
}

function bigMethodFixture(): string {
	return `${[
		'export class BigMethod {',
		'\trun(): void {',
		...Array.from({ length: 36 }, () => '\t\tvoid 1;'),
		'\t}',
		'}'
	].join('\n')}\n`;
}

function manyClassesFixture(): string {
	return "export class FirstThing {\n\tvalue = 'first';\n}\n\nexport class SecondThing {\n\tvalue = 'second';\n}\n";
}

function branchyFixture(): string {
	return `${[
		'export function branchy(value: number): number {',
		'\tlet total = 0;',
		...Array.from({ length: 11 }, (_, index) => `\tif (value > ${index}) total += ${index};`),
		'\treturn total;',
		'}'
	].join('\n')}\n`;
}

function nestedFixture(): string {
	return `${[
		'export function nested(value: boolean): void {',
		'\tif (value) {',
		'\t\tif (value) {',
		'\t\t\tif (value) {',
		'\t\t\t\tif (value) {',
		'\t\t\t\t\tif (value) {',
		'\t\t\t\t\t\tvoid 1;',
		'\t\t\t\t\t}',
		'\t\t\t\t}',
		'\t\t\t}',
		'\t\t}',
		'\t}',
		'}'
	].join('\n')}\n`;
}

function tooManyFixture(): string {
	return `${[
		'export function tooMany(a: string, b: string, c: string, d: string, e: string): string {',
		'\treturn a + b + c + d + e;',
		'}'
	].join('\n')}\n`;
}

function nestedTernaryFixture(): string {
	return `${[
		'export function label(value: number): string {',
		"\treturn value > 1 ? 'many' : value > 0 ? 'one' : 'none';",
		'}'
	].join('\n')}\n`;
}
