import { expect, test } from 'vitest';
import { harnessRuleLimits, harnessRuleSummaries } from '../src/rules/catalog';
import { lintConfigFiles } from '../src/templates/development-tooling/lintConfig';
import { ESLint } from 'eslint';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('Harness rule catalog defines Small Harness thresholds', () => {
	expect(harnessRuleLimits).toMatchObject({
		maxFileLines: 220,
		maxFunctionLines: 55,
		maxClassLines: 120,
		maxMethodLines: 35,
		maxNestingDepth: 4,
		maxParameters: 4,
		maxComplexity: 10,
		maxClassesPerFile: 1
	});
	expect(harnessRuleSummaries.length).toBeGreaterThan(8);
});

test('current and generated lint rules handle TypeScript overloads without losing guards', async () => {
	const current = new ESLint();
	await checkDeclarations(
		current,
		resolve('src/helpers/agents-providers/featurePlanGraphUncertainty.ts')
	);
	const root = await mkdtemp(join(tmpdir(), 'harness-lint-typescript-'));
	try {
		await mkdir(join(root, 'src'));
		await symlink(resolve('node_modules'), join(root, 'node_modules'), 'dir');
		await writeFile(join(root, 'package.json'), '{"type":"module"}');
		await writeFile(
			join(root, 'tsconfig.json'),
			'{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}'
		);
		const file = join(root, 'src/probe.ts');
		await writeFile(file, 'export const probe = 1;\n');
		for (const item of lintConfigFiles()) await writeFile(join(root, item.path), item.contents);
		const generated = new ESLint({
			cwd: root,
			overrideConfigFile: join(root, 'eslint.config.js'),
			overrideConfig: { languageOptions: { parserOptions: { tsconfigRootDir: root } } }
		});
		await checkDeclarations(generated, file);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

async function checkDeclarations(eslint: ESLint, filePath: string) {
	const valid = [
		'export function convert(value: string): string;',
		'export function convert(value: number): number;',
		'export function convert(value: string | number) { return value; }',
		'const { secret, ...visible } = { secret: 1, value: 2 };',
		'console.log(visible);'
	].join('\n');
	const invalid =
		'const duplicate = 1; const duplicate = 2; const unused = 3; console.log(duplicate);';
	const [pass] = await eslint.lintText(valid, { filePath });
	expect(pass.messages.filter((message) => message.severity === 2)).toEqual([]);
	const [fail] = await eslint.lintText(invalid, { filePath });
	expect(fail.messages.map((message) => message.ruleId)).toEqual(
		expect.arrayContaining(['@typescript-eslint/no-redeclare', '@typescript-eslint/no-unused-vars'])
	);
}
