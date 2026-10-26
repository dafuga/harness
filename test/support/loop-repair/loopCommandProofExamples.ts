const captureCommit = [
	'git',
	'-c',
	'user.name=Fixture',
	'-c',
	'user.email=fixture@harness.invalid',
	'commit',
	'-qm',
	'fix: capture existing behavior'
];
import { expectCaptureBindings } from './observedLoop';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCommand, runHarness } from '../cli';
import { expectFailedCapture } from './captureFixture';
import { prepareRepair, exerciseRepair, expectPendingVerification } from '../loopRepair';
export async function repairExample(template: string): Promise<void> {
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
}
export async function captureExample(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-capture-cli-'));
	try {
		await runCommand(['git', 'init', '-q'], root);
		await runCommand(['git', 'config', 'user.name', ''], root);
		await runCommand(['git', 'config', 'user.email', ''], root);
		await prepareRepair(root, 'bug-fix');
		await writeFile(
			join(root, 'source.ts'),
			'export function selectedValue(): number { return 3; }'
		);
		await runCommand(['git', 'add', 'source.ts'], root);
		await runCommand(captureCommit, root);
		const result = await runHarness(
			[
				'loop',
				'record',
				'repair',
				'--phase',
				'capture',
				'--test',
				'proof.ts',
				'--unit',
				'function.sample',
				'--command',
				'bun proof.ts',
				'--json'
			],
			root,
			false
		);
		expect(result.exitCode, 'standalone capture needs no fabricated failing checkpoint').toBe(0);
		const record = JSON.parse(result.stdout);
		expect(record).toMatchObject({ phase: 'capture', status: 'passed' });
		expect(record.red).toBeUndefined();
		await runHarness(['history', 'build', '--out', 'history', '--limit', '3'], root);
		const detail = JSON.parse(
			await readFile(join(root, 'history/revisions', record.source.commit + '.json'), 'utf8')
		);
		expect(detail.regressions).toContainEqual(
			expect.objectContaining({
				red: null,
				green: expect.objectContaining({ id: record.id, captures: expect.any(Array) })
			})
		);
		const status = await runHarness(['history', 'status', '--json'], root);
		expect(JSON.parse(status.stdout).verified).toBe(false);
		await expectFailedCapture(root);
		await expectCaptureBindings(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}
