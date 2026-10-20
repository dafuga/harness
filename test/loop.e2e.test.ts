import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';
import { prepareRepair, exerciseRepair, expectPendingVerification } from './support/loopRepair';
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

test('loop CLI creates from templates, searches, guides next, and evaluates', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-cli-'));
	try {
		await writeTemplate(root);

		const search = await runHarness(['loop', 'search', 'proof', '--json'], root);
		await runHarness(
			['loop', 'create', 'proof-loop', '--from', 'proof', '--goal', 'CLI proof'],
			root
		);
		const next = await runHarness(['loop', 'next', 'proof-loop', '--json'], root);
		const evaluated = await runHarness(['loop', 'evaluate', 'proof-loop', '--json'], root);

		expect(JSON.parse(search.stdout).map((result: { id: string }) => result.id)).toContain('proof');
		expect(JSON.parse(next.stdout).step.id).toBe('verify');
		expect(JSON.parse(next.stdout).evaluator.command).toBe('bun --version');
		expect(JSON.parse(evaluated.stdout).passed).toBe(true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function readTrace(project: string): Promise<string> {
	return readFile(join(project, 'specification/loops/newsletter-signup/trace.ndjson'), 'utf8');
}

test('feature completion rejects an unsupported free-text verification claim', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-loop-completion-'));
	try {
		await runHarness(
			['loop', 'create', 'delivery', '--from', 'feature', '--goal', 'Deliver search'],
			root
		);
		for (const step of ['spec', 'implement', 'test'])
			await runHarness(['loop', 'complete', 'delivery', step, '--evidence', 'Recorded work'], root);
		const done = await runHarness(
			['loop', 'complete', 'delivery', 'verify', '--evidence', 'Everything passed'],
			root,
			false
		);
		expect(done.exitCode, 'a claim cannot substitute for the completion audit').toBe(1);
		expect(done.stderr).toContain('completion audit');
		const status = await runHarness(['loop', 'status', 'delivery', '--json'], root);
		expect(JSON.parse(status.stdout).state.steps.at(-1).status).toBe('pending');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 120_000);

async function writeTemplate(root: string): Promise<void> {
	const dir = join(root, 'specification/loop-templates');
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, 'proof.json'),
		JSON.stringify({
			id: 'proof',
			title: 'Proof Loop',
			summary: 'Proves evaluator CLI behavior.',
			steps: [{ id: 'verify', title: 'Verify the command.' }],
			evaluators: [{ id: 'version', title: 'Check Bun.', command: 'bun --version', step: 'verify' }]
		})
	);
}

test.each(['bug-fix', 'fix', 'regression-prevention'])(
	'%s CLI records proof and leaves verification pending across failed and passing checks',
	async (template) => {
		const root = await mkdtemp(join(tmpdir(), 'harness-regression-cli-'));
		try {
			await prepareRepair(root, template);
			const skipped = await runHarness(
				['loop', 'complete', 'repair', 'implement', '--evidence', 'Skip the diagnosis'],
				root,
				false
			);
			expect(skipped.exitCode).toBe(1);
			expect(skipped.stderr).toContain('before');
			const status = await runHarness(['loop', 'status', 'repair', '--json'], root);
			const steps = JSON.parse(status.stdout).state.steps as { id: string }[];
			expect(steps.map((step) => step.id)).toContain('coverage');
			await exerciseRepair(root, steps);
			await expectPendingVerification(root);
			await runHarness(
				['loop', 'complete', 'repair', 'verify', '--evidence', 'bun run check passed after repair'],
				root
			);
			const next = await runHarness(['loop', 'next', 'repair', '--json'], root);
			expect(JSON.parse(next.stdout).step).toBeUndefined();
			const trace = await readFile(join(root, 'specification/loops/repair/trace.ndjson'), 'utf8');
			expect(trace).toContain('"passed":false');
			expect(trace).toContain('"passed":true');
			expect(trace).toContain('existing test checked only positivity');
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	},
	120_000
);
