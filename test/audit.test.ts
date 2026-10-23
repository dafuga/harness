import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { auditPath } from '../src/audit/audit';
import { ruleFixtures } from './support/auditFixtures';
import { measureWorkload } from './support/measureWorkload';

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

test('audit ignores symlinks without following missing build outputs', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	await mkdir(join(root, 'bin'));
	await symlink('../build/missing-tool', join(root, 'bin/tool'));

	const findings = await auditPath(root);

	expect(findings).toEqual([]);
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

test('audit reports Harness scaffold file and function naming violations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	await mkdir(join(root, 'src/services'), { recursive: true });
	await mkdir(join(root, 'src/utils'), { recursive: true });
	await mkdir(join(root, 'src/concerns'), { recursive: true });
	await mkdir(join(root, 'src/configs'), { recursive: true });
	await mkdir(join(root, 'db/migrations'), { recursive: true });

	const fixtures = {
		'src/services/post-service.ts':
			"export class PostService {\n\trun(): string {\n\t\treturn 'ok';\n\t}\n}\n",
		'src/utils/format-date.ts':
			'export function format_date(value: string): string {\n\treturn value;\n}\n',
		'src/utils/configValue.types.ts': 'export interface ConfigValue { literal?: unknown; }\n',
		'src/concerns/publishable.ts':
			'export function publishable<T extends object>(input: T): T {\n\treturn input;\n}\n',
		'db/migrations/CreatePosts.sql': '-- reversible: ok\n',
		'src/configs/bad-config.ts': 'export const badConfig = { enabled: true };\n'
	};
	for (const [file, source] of Object.entries(fixtures)) await writeFile(join(root, file), source);

	const findings = await measureWorkload(
		'audit.scaffold-naming-rules',
		'audit-config-and-type-naming',
		() => auditPath(root)
	);
	const rules = findings.map((finding) => finding.rule);

	expect(rules).toContain('file-name-pattern');
	expect(rules).toContain('function-name-pattern');
	expect(findings.filter((finding) => finding.path === 'src/utils/configValue.types.ts')).toEqual(
		[]
	);
	expect(findings.filter((finding) => finding.rule === 'harness-source-structure')).toEqual([]);
	expect(
		findings.some(
			(finding) =>
				finding.path === 'src/configs/bad-config.ts' && finding.rule === 'file-name-pattern'
		)
	).toBe(true);
	await rm(root, { recursive: true, force: true });
});

test('audit rejects files and folders outside the Harness structure', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	await mkdir(join(root, 'src/random-things'), { recursive: true });
	await mkdir(join(root, 'test/random-things'), { recursive: true });
	await mkdir(join(root, 'db/archive'), { recursive: true });
	await mkdir(join(root, 'specification/features/Draft'), { recursive: true });

	await writeFile(join(root, 'task.ts'), 'export const task = true;\n');
	await writeFile(join(root, 'src/random-things/tool.ts'), 'export const tool = true;\n');
	await writeFile(
		join(root, 'test/random-things/tool.test.ts'),
		'import { test } from "vitest";\n'
	);
	await writeFile(join(root, 'db/archive/old.sql'), 'select 1;\n');
	await writeFile(join(root, 'specification/features/Draft/BadName.md'), '# Feature\n');

	const findings = await auditPath(root);
	const rules = findings.map((finding) => finding.rule);

	expect(rules).toEqual(
		expect.arrayContaining([
			'folder-name-pattern',
			'harness-root-file-structure',
			'harness-source-structure',
			'harness-test-structure',
			'harness-db-structure',
			'harness-spec-structure'
		])
	);
	await rm(root, { recursive: true, force: true });
});

test('audit honors local ignored finding baselines', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	await writeFile(
		join(root, 'large.ts'),
		Array.from({ length: 225 }, () => 'export {};').join('\n')
	);
	await writeFile(
		join(root, 'harness.audit.json'),
		JSON.stringify({
			ignore: [
				{ path: 'large.ts', rule: 'small-file', reason: 'legacy file split tracked separately' }
			]
		})
	);

	const findings = await auditPath(root);

	expect(findings.some((finding) => finding.rule === 'small-file')).toBe(false);
	await rm(root, { recursive: true, force: true });
});

test('every SvelteKit route segment form is a valid folder name, and nothing else in brackets is', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-audit-'));
	const valid = ['[id]', '[...path]', '[[lang]]', '[id=integer]', '[...rest=slug]', '(group)'];
	const invalid = ['[..path]', '[Bad Name]', '[[lang]', '[id=]', '[...]'];
	for (const segment of [...valid, ...invalid]) {
		await mkdir(join(root, 'src/routes/pages', segment), { recursive: true });
		await writeFile(
			join(root, 'src/routes/pages', segment, '+server.ts'),
			'export const GET = () => new Response();\n'
		);
	}
	const findings = await auditPath(root);
	await rm(root, { recursive: true, force: true });
	const flagged = findings
		.filter((finding) => finding.rule === 'folder-name-pattern')
		.map((finding) => finding.path.replace(/\/$/, '').split('/').pop());
	expect(flagged.sort()).toEqual([...invalid].sort());
});
