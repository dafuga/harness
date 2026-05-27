import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';

test('loop CLI traces work and remains audit-safe in generated projects', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-e2e-'));
	try {
		await runHarness(['new', 'app', 'loop-app'], root);
		const project = join(root, 'loop-app');

		await runHarness(['loop', 'create', 'newsletter-signup', '--goal', 'Collect emails'], project);
		await runHarness(
			['loop', 'add', 'newsletter-signup', 'verify', '--title', 'Run checks and browser proof'],
			project
		);
		const complete = await runHarness(
			['loop', 'complete', 'newsletter-signup', 'verify', '--evidence', 'bun run check passed'],
			project
		);
		const status = await runHarness(['loop', 'status', 'newsletter-signup', '--json'], project);
		const audit = await runHarness(['audit', '.'], project);

		expect(complete.stdout).toContain('[complete] verify - Run checks and browser proof');
		expect(JSON.parse(status.stdout).state.steps[0]).toMatchObject({
			id: 'verify',
			status: 'complete',
			evidence: 'bun run check passed'
		});
		expect(audit.stdout).toContain('Harness audit passed');
		expect(await readTrace(project)).toContain('"event":"step.completed"');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

test('generated app and lib instructions mention harness loops', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-instructions-'));
	try {
		await runHarness(['new', 'app', 'guided-app'], root);
		await runHarness(['new', 'lib', 'guided-lib'], root);

		for (const projectName of ['guided-app', 'guided-lib']) {
			const agents = await readFile(join(root, projectName, 'AGENTS.md'), 'utf8');
			const skill = await readFile(
				join(root, projectName, '.codex/skills/harness/SKILL.md'),
				'utf8'
			);

			expect(agents).toContain('create or continue a `harness loop`');
			expect(skill).toContain('create or continue a `harness loop`');
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function readTrace(project: string): Promise<string> {
	return readFile(join(project, 'specification/loops/newsletter-signup/trace.ndjson'), 'utf8');
}
