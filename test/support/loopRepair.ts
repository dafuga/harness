import { captureFixture, expectSquashedScreens } from './loop-repair/captureFixture';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCommand, runHarness } from './cli';
import { HistoryNoteRepository } from '../../src/repositories/history-note-repository/HistoryNoteRepository';
import { EvidenceTreeAdapter } from '../../src/adapters/EvidenceTreeAdapter';
import { readRegression } from '../../src/utils/regressionHistory';

export async function prepareRepair(root: string, template: string): Promise<void> {
	await writeFile(
		join(root, 'package.json'),
		JSON.stringify({ scripts: { check: 'bun proof.ts' } })
	);
	await writeFile(join(root, 'source.ts'), 'export const value = 1;');
	await writeFile(
		join(root, 'proof.ts'),
		"import { value } from './source'; if (value < 0) process.exit(1);"
	);
	const captureScript = await captureFixture(root);
	await runCommand(['git', 'init', '-q'], root);
	await runCommand(['git', 'config', 'user.name', 'Harness Fixture'], root);
	await runCommand(['git', 'config', 'user.email', 'fixture@harness.invalid'], root);
	await commitRepair(root, 'feat: existing value and test');
	await runHarness(
		['loop', 'create', 'repair', '--from', template, '--goal', 'Persist the selected value'],
		root
	);
	const old = await runHarness(['loop', 'evaluate', 'repair', '--json'], root);
	expect(JSON.parse(old.stdout).passed).toBe(true);
	await writeFile(join(root, 'proof.ts'), captureScript);
	await commitRepair(root, 'fix: commit the failing selected-value test');
}

export async function exerciseRepair(root: string, steps: { id: string }[]): Promise<void> {
	const frozen = await readFile(join(root, 'proof.ts'), 'utf8');
	for (const step of steps.filter((item) => item.id !== 'verify')) {
		const next = await runHarness(['loop', 'next', 'repair', '--json'], root);
		expect(JSON.parse(next.stdout).step.id).toBe(step.id);
		if (step.id === 'red' || step.id === 'green') {
			await phaseProof(root, step.id, frozen);
		}
		if (step.id === 'implement') {
			await writeFile(join(root, 'source.ts'), 'export const value = 3;');
			await commitRepair(root, 'fix: persist the selected value');
		}
		const evidence = `${step.id}: existing test checked only positivity; strengthen the shared selected-value assertion; bun run check fails at 1 versus 3, passes unchanged after repairing source.`;
		await runHarness(['loop', 'complete', 'repair', step.id, '--evidence', evidence], root);
	}
}

async function rejected(root: string, flags: string[], reason: string): Promise<void> {
	const result = await runHarness(['loop', 'record', 'repair', ...flags, '--json'], root, false);
	expect(result.exitCode).toBe(1);
	expect(result.stderr).toContain(reason);
}

async function rejectChangedTest(root: string, frozen: string): Promise<void> {
	await writeFile(join(root, 'proof.ts'), `${frozen}\n// The regression was changed.\n`);
	await runCommand(['git', 'add', 'proof.ts'], root);
	const tree = (await runCommand(['git', 'write-tree'], root)).stdout.trim();
	const bad = await runCommand(
		[
			'git',
			'-c',
			'user.name=Harness Fixture',
			'-c',
			'user.email=fixture@harness.invalid',
			'commit-tree',
			tree,
			'-p',
			'HEAD',
			'-m',
			'fix: alter the test after its failing commit'
		],
		root
	);
	await writeFile(join(root, 'proof.ts'), frozen);
	await runCommand(['git', 'reset', '-q', 'HEAD', '--', 'proof.ts'], root);
	await rejected(root, ['--phase', 'green', '--commit', bad.stdout.trim()], 'unchanged');
}
async function commitRepair(root: string, message: string): Promise<void> {
	await runCommand(['git', 'add', '-A'], root);
	await runCommand(
		[
			'git',
			'-c',
			'user.name=Harness Fixture',
			'-c',
			'user.email=fixture@harness.invalid',
			'commit',
			'-qm',
			message
		],
		root
	);
}

export async function expectPendingVerification(root: string): Promise<void> {
	const next = await runHarness(['loop', 'next', 'repair', '--json'], root);
	expect(JSON.parse(next.stdout).step).toMatchObject({ id: 'verify', status: 'pending' });
	expect(JSON.parse(next.stdout).evaluator.command).toBe('bun run check');
}

async function phaseProof(root: string, phase: string, frozen: string): Promise<void> {
	if (phase === 'red') await rejectMissingProof(root);
	const result = await runHarness(['loop', 'evaluate', 'repair', '--json'], root, false);
	expect(JSON.parse(result.stdout).passed).toBe(phase === 'green');
	expect(result.exitCode).toBe(phase === 'green' ? 0 : 1);
	expect(await readFile(join(root, 'proof.ts'), 'utf8')).toBe(frozen);
	const flags =
		phase === 'red'
			? ['--test', 'proof.ts', '--command', 'bun proof.ts', '--assertion', '1 !== 3']
			: [];
	if (phase === 'green') await rejectChangedTest(root, frozen);
	const recorded = await runHarness(
		['loop', 'record', 'repair', '--phase', phase, ...flags, '--json'],
		root
	);
	expect(JSON.parse(recorded.stdout)).toMatchObject({
		phase: phase,
		status: phase === 'red' ? 'failed' : 'passed'
	});
	expect(
		JSON.parse(recorded.stdout).measurements,
		'focused proof retains benchmark measurements'
	).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				metric: 'latency-warm-ms',
				value: 0.5,
				testedRevision: expect.any(String)
			})
		])
	);
	const saved = JSON.parse(recorded.stdout);
	expect(
		saved.captures ?? [],
		'focused screenshots survive the committed checkpoint'
	).toContainEqual(
		expect.objectContaining({
			unit: 'page.sample',
			capture: expect.objectContaining({
				kind: 'screenshot',
				viewport: 'desktop',
				sha256: expect.any(String)
			})
		})
	);
	expect(saved.captures, 'declared screenshot slots keep their registered unit').toContainEqual(
		expect.objectContaining({
			unit: 'function.sample',
			capture: expect.objectContaining({ evidence: 'sample-screen' })
		})
	);
	if (phase === 'green') await expectSavedScreens(root, saved.source.commit);
	if (phase === 'red') await rejected(root, ['--phase', 'green'], 'separate fix commit');
}

/** A Git-backed rebuild keeps the pixels, while loss of those bytes rejects the proof. */
async function expectSavedScreens(root: string, commit: string): Promise<void> {
	await expectSquashedScreens(root, commit);
	const out = join(root, 'history');
	await runHarness(['history', 'build', '--out', out, '--limit', '3'], root);
	const index = JSON.parse(await readFile(join(out, 'index.json'), 'utf8'));
	expect(index.benchmarks, 'history retains focused performance observations').toContainEqual(
		expect.objectContaining({ unit: 'function.sample', metric: 'latency-warm-ms' })
	);
	const detail = JSON.parse(await readFile(join(out, 'revisions', commit + '.json'), 'utf8'));
	expect(detail.regressions[0].green.captures).toContainEqual(
		expect.objectContaining({
			unit: 'function.sample',
			capture: expect.objectContaining({ media: expect.stringMatching(/^media\//) })
		})
	);
	const screen = detail.regressions[0].green.captures[0];
	for (const kept of detail.regressions[0].green.captures) {
		const bytes = await readFile(join(out, kept.capture.media));
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(kept.capture.sha256);
	}
	expect(screen.capture.media, 'rebuilt history resolves focused screenshot media').toMatch(
		/^media\//
	);
	expect((await readFile(join(out, screen.capture.media))).length).toBe(screen.capture.bytes);
	const note = (await new HistoryNoteRepository(root).read(commit)).entries.find(
		(entry) => entry.kind === 'regression' && entry.phase === 'green'
	);
	if (note?.kind !== 'regression') throw new Error('Expected the recorded checkpoint');
	const tree = new EvidenceTreeAdapter(root);
	await expect(
		readRegression(note, (path) =>
			path === screen.capture.path
				? Promise.resolve(undefined)
				: tree.read(note.evidence.commit, note.evidence.path + '/' + path)
		)
	).rejects.toThrow(/capture.*missing/i);
}

async function rejectMissingProof(root: string): Promise<void> {
	const missing = await runHarness(
		['loop', 'complete', 'repair', 'red', '--evidence', 'Trust me'],
		root,
		false
	);
	expect(missing.exitCode, 'A regression step needs a committed failing test').toBe(1);
	expect(missing.stderr).toContain('committed failing test');
}
