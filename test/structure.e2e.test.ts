import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { commandOutput, runCommand, runHarness } from './support/cli';

test('generated projects reject bad Harness structure through audit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-bad-structure-'));
	try {
		await runHarness(['new', 'lib', 'bad-structure'], root);
		const project = join(root, 'bad-structure');

		await writeBadStructureFixtures(project);

		const auditFailure = await runHarness(['audit', '.'], project, false);
		expect(auditFailure.exitCode).toBe(1);
		expectRules(commandOutput(auditFailure), structureAuditRuleIds);

		const scriptFailure = await runCommand(['bun', 'run', 'audit'], project, false);
		expect(scriptFailure.exitCode).toBe(1);
		expect(commandOutput(scriptFailure)).toContain('harness-source-structure');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

const structureAuditRuleIds = [
	'folder-name-pattern',
	'harness-root-file-structure',
	'harness-source-structure',
	'harness-test-structure',
	'harness-db-structure',
	'harness-e2e-structure',
	'harness-spec-structure'
];

test('Codex marketplace structure is accepted while unrelated hidden folders are rejected', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-marketplace-'));
	try {
		await runHarness(['new', 'lib', 'marketplace-project'], root);
		const project = join(root, 'marketplace-project');
		await mkdir(join(project, '.agents/plugins'), { recursive: true });
		await writeFile(
			join(project, '.agents/plugins/marketplace.json'),
			'{"name":"fixture","plugins":[]}'
		);
		const accepted = await runHarness(['audit', '.'], project, false);
		expect(accepted.exitCode).toBe(0);
		await mkdir(join(project, '.unrelated-hidden'), { recursive: true });
		await writeFile(join(project, '.unrelated-hidden/fixture.txt'), 'fixture');
		const rejected = await runHarness(['audit', '.'], project, false);
		expect(rejected.exitCode).toBe(1);
		expect(commandOutput(rejected)).toContain('folder-name-pattern');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 30_000);

async function writeBadStructureFixtures(project: string): Promise<void> {
	await mkdir(join(project, 'src/BadFolder'), { recursive: true });
	await mkdir(join(project, 'test/random-things'), { recursive: true });
	await mkdir(join(project, 'tests/integration'), { recursive: true });
	await mkdir(join(project, 'db/archive'), { recursive: true });
	await mkdir(join(project, 'specification/features/Draft'), { recursive: true });

	await writeFile(join(project, 'task.ts'), 'export const task = true;\n');
	await writeFile(join(project, 'src/BadFolder/tool.ts'), 'export const tool = true;\n');
	await writeFile(
		join(project, 'test/random-things/tool.test.ts'),
		"import { test } from 'vitest';\n"
	);
	await writeFile(
		join(project, 'tests/integration/tool.spec.ts'),
		"import { test } from 'vitest';\n"
	);
	await writeFile(join(project, 'db/archive/old.sql'), 'select 1;\n');
	await writeFile(join(project, 'specification/features/Draft/BadName.md'), '# Feature\n');
}

function expectRules(output: string, rules: string[]): void {
	for (const rule of rules) {
		expect(output, rule).toContain(rule);
	}
}

test('categorized projects generate dynamic folders and audit rejects flat implementations', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-category-structure-'));
	try {
		await runHarness(['new', 'lib', 'categorized'], root);
		const project = join(root, 'categorized');
		await runHarness(
			['generate', 'unit', 'Invoice', '--kind', 'service', '--group', 'billing'],
			project
		);
		const category = await readFile(join(project, 'harness.groups.json'), 'utf8');
		expect(JSON.parse(category).groups).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 'billing' })])
		);
		await runHarness(['units', 'index', '--write'], project);
		const indexed = await runHarness(['units', 'check'], project);
		expect(indexed.exitCode).toBe(0);
		const accepted = await runHarness(['audit', '.'], project);
		expect(accepted.exitCode).toBe(0);
		await writeFile(
			join(project, 'src/services/FlatService.ts'),
			'export class FlatService { run() {} }\n'
		);
		const rejected = await runHarness(['audit', '.'], project, false);
		expect(rejected.exitCode).toBe(1);
		expect(commandOutput(rejected)).toContain('module-category-folder');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 60_000);
