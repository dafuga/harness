import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { expect } from 'vitest';
import { expectMissingScreenshotResults } from './browserBaselineResults';
import { runCommand, runHarness } from './cli';

/** Exercise real generated visual cases against a committed and stamped disposable app. */
export async function assertGeneratedVisualEvidence(project: string): Promise<void> {
	const stamp = await runHarness(['verify', 'stamp', '.svelte-kit/output', '--json'], project);
	const buildId = (JSON.parse(stamp.stdout) as { buildId: string }).buildId;
	expect(buildId).toMatch(/^[a-f0-9]{64}$/);
	await runCommand(['git', 'init', '-q'], project);
	await appendFile(join(project, '.git/info/exclude'), '\ntest-results/\nplaywright-report/\n');
	await runCommand(['git', 'add', '--all'], project);
	await runCommand(
		[
			'git',
			'-c',
			'user.name=Harness Fixture',
			'-c',
			'user.email=fixture@harness.invalid',
			'-c',
			'commit.gpgsign=false',
			'commit',
			'-qm',
			'feat: generated visual fixture'
		],
		project
	);
	const revision = (await runCommand(['git', 'rev-parse', 'HEAD'], project)).stdout.trim();
	expect(revision).toMatch(/^[a-f0-9]{40}$/);
	expect((await runCommand(['git', 'status', '--porcelain'], project)).stdout).toBe('');
	for (const [scenario, unit, file] of [
		['initial-page', 'page.root', 'app.spec.ts'],
		['component-status-badge', 'component.status-badge', 'status-badge-component.spec.ts'],
		['layout-dashboard', 'layout.dashboard', 'dashboard-layout.spec.ts']
	] as const) {
		await assertScenario(project, { scenario, unit, file, revision, buildId });
	}
}

async function assertScenario(
	project: string,
	input: { scenario: string; unit: string; file: string; revision: string; buildId: string }
): Promise<void> {
	const directory = join(dirname(project), `evidence-${input.scenario}`);
	const manifest = JSON.parse(
		await readFile(join(project, 'specification/units', `${input.unit}.json`), 'utf8')
	) as {
		testing: { cases: Array<{ id: string; state: string; viewports: string[] }> };
	};
	const cases = manifest.testing.cases;
	const run = await runCommand(
		['bun', 'x', 'playwright', 'test', `tests/e2e/${input.file}`],
		project,
		false,
		{
			HARNESS_VERIFY: '1',
			HARNESS_VERIFY_CASE_ROOT: project,
			HARNESS_VERIFY_REVISION: input.revision,
			HARNESS_SCENARIO: input.scenario,
			HARNESS_EVIDENCE_DIR: directory,
			TAKE_SCREENSHOT: '1'
		}
	);
	expect(run.exitCode).toBe(1);
	await expectMissingScreenshotResults(project, run.stdout + run.stderr, cases.length);
	const index = await readFile(join(directory, 'captures.ndjson'), 'utf8').catch(
		(error: unknown) => {
			if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
				return '';
			throw error;
		}
	);
	expect(index, 'Generated visual cases register case-bound screenshots').not.toBe('');
	const captures = index
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line) as { note?: string; file: string });
	expect(captures).toHaveLength(cases.length);
	for (const item of cases) await assertCapture(directory, captures, item, input);
}

async function assertCapture(
	directory: string,
	captures: Array<{ note?: string; file: string }>,
	item: { id: string; state: string; viewports: string[] },
	input: { unit: string; revision: string; buildId: string }
): Promise<void> {
	const found = captures.filter((capture) => JSON.parse(capture.note ?? '{}').case === item.id);
	expect(found, item.id).toHaveLength(1);
	const capture = found[0];
	expect(capture).toMatchObject({
		evidence: 'screens',
		kind: 'screenshot',
		state: item.state,
		viewport: item.viewports[0],
		mediaType: 'image/png',
		provenance: 'actual-capture',
		server: { revision: input.revision, buildId: input.buildId }
	});
	expect(capture.file).toBe(basename(capture.file));
	const bytes = await readFile(join(directory, capture.file));
	expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	expect(JSON.parse(capture.note ?? '{}')).toEqual({
		unit: input.unit,
		case: item.id,
		revision: input.revision,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		retry: 0
	});
}
