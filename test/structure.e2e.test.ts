import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
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
