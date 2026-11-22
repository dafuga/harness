import { runHarness } from './cli';
import type { EvidenceFixture } from './moduleTaskEvidence.types';

const reason = [
	'--behavior',
	'Fixture change.',
	'--simplification',
	'Nothing simpler was found.',
	'--simplification-outcome',
	'not-improved',
	'--performance',
	'No hot path is touched.',
	'--performance-outcome',
	'not-applicable'
];

/** Gives the fixture's committed module a passing verification baseline before tasks are added. */
export async function verifiedTaskBaseline(f: EvidenceFixture): Promise<string> {
	await harness(f, ['explain', 'add', '--all', '--base', 'none', '--head', 'HEAD', ...reason]);
	const first = await verify(f, 'HEAD', false);
	await harness(f, [
		...['budget', 'establish', '--all', '--record', first.id],
		...['--reviewer', 'Reviewer One', '--reason', 'Reviewed fixture baseline']
	]);
	await f.git.run(['add', 'specification/budgets']);
	await f.git.run(['commit', '-qm', 'chore: establish baselines']);
	const baseline = await verify(f, 'HEAD');
	if (baseline.status !== 'passed') throw new Error('The fixture baseline did not verify clean.');
	return f.git.run(['rev-parse', 'HEAD']);
}

/** Explains and verifies a submitted checkpoint the way a reviewer does before accepting it. */
export async function verifiedSubmission(
	f: EvidenceFixture,
	task: { sourceCommit: string; result: { checkpointCommit: string } }
): Promise<{ commit: string; id: string; status: string }> {
	const commit = task.result.checkpointCommit;
	await harness(f, [
		...['explain', 'add', '--all', '--base', task.sourceCommit, '--head', commit],
		...reason
	]);
	return { commit, ...(await verify(f, commit)) };
}

async function verify(f: EvidenceFixture, commit: string, success = true) {
	const result = await harness(f, ['verify', 'run', '--json', '--commit', commit], success);
	return JSON.parse(result.stdout).record as { id: string; status: string };
}

function harness(f: EvidenceFixture, args: string[], success = true) {
	return runHarness(args, f.root, success, { HARNESS_ANALYTICS_DISABLED: '1' });
}
