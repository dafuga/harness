import type { RecordRegressionInput } from './recordRegression.types';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { UnitRegistryRepository } from '../../../repositories/verification-evidence/UnitRegistryRepository';
import { HistoryNoteRepository } from '../../../repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import { sameRegression } from '../../../utils/git-source-history/regressionHistory';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { fail } from '../../../core/development-tooling/errors';
import {
	regressionPhaseSchema,
	type RegressionRecord
} from '../../../core/verification-evidence/regressionTypes';
import { RegressionProofRepository } from '../../../repositories/verification-evidence/RegressionProofRepository';
import { RegressionProofService } from './RegressionProofService';
import {
	loopPaths,
	readLoop,
	validateLoopId,
	type LoopState
} from '../../development-tooling/loop-state/loopState';
import {
	regressionFiles,
	regressionFixCommit
} from '../../../utils/verification-evidence/regressionFiles';
import { regressionTestCommit } from './regressionFiles';

/** A successful command stores proof of the declared phase; red itself remains a failure. */
export async function recordRegression(input: RecordRegressionInput) {
	const root = input.root ?? process.cwd();
	const loop = validateLoopId(input.loop, 'Loop name');
	await readLoop(loopPaths(root, loop).state);
	const phase = regressionPhaseSchema.safeParse(input.phase);
	if (!phase.success) return fail('Evidence phase must be red, green or capture.');
	const commit = await new GitAdapter(root).run([
		'rev-parse',
		'--verify',
		'--end-of-options',
		`${input.commit ?? 'HEAD'}^{commit}`
	]);
	const repository = new RegressionProofRepository(root);
	const note = phase.data === 'green' ? await repository.latest(loop, 'red', commit) : undefined;
	const red = note ? (await repository.load(note)).record : undefined;
	if (phase.data === 'green' && !red)
		return fail('First record the committed failing test with loop record --phase red.');
	const request = regressionRequest(evidenceRequest(input), red);
	const knownUnits = await declaredUnits(root, commit, request.units);
	await regressionFiles(root, commit, request.tests);
	if (red) await regressionFixCommit(root, commit, red);
	else if (phase.data === 'red') await regressionTestCommit(root, commit, request.tests);
	return new RegressionProofService(root).run({
		...request,
		knownUnits,
		commit,
		loop,
		phase: phase.data,
		timeoutMs: regressionTimeout(input.timeout),
		red
	});
}

function evidenceRequest(input: RecordRegressionInput): RecordRegressionInput {
	return input.phase === 'capture'
		? { ...input, assertion: input.assertion ?? 'Focused evidence capture completed.' }
		: input;
}

/** New regression loops cannot replace recorded observations with free-text evidence. */
export async function requireRegressionProof(root: string, loop: string, step: string) {
	if (!['red', 'implement', 'green', 'guard', 'verify'].includes(step)) return;
	const git = new GitAdapter(root);
	const commit = await git.attempt(['rev-parse', '--verify', 'HEAD']);
	const phase = ['red', 'implement'].includes(step) ? 'red' : 'green';
	const repository = new RegressionProofRepository(root);
	const note = commit ? await repository.latest(loop, phase, commit) : undefined;
	if (!note)
		fail(
			`Record the committed ${phase === 'red' ? 'failing test' : 'passing fix'} with harness loop record before completing ${step}.`
		);
	const proof = await repository.load(note);
	if (['red', 'green', 'guard', 'verify'].includes(step) && proof.record.source.commit !== commit)
		fail('Complete this regression step at its current tested commit.');
	if (phase === 'green') await requirePairedProof(root, repository, proof.record);
}

async function requirePairedProof(
	root: string,
	repository: RegressionProofRepository,
	green: RegressionRecord
) {
	const origin = green.red;
	if (!origin) fail('The committed failing test is missing.');
	const notes = await new HistoryNoteRepository(root).read(origin.commit);
	const note = notes.entries.find(
		(item) => item.kind === 'regression' && item.record === origin.record
	);
	if (note?.kind !== 'regression') fail('The committed failing test is missing.');
	const red = (await repository.load(note)).record;
	if (!sameRegression(red, green)) fail('The recorded regression must remain unchanged.');
	await regressionFixCommit(root, green.source.commit, red);
}

/** Adopt unfinished older flows when their red phase begins; historical proof is unchanged. */
export async function enforceRegressionStep(root: string, state: LoopState, step: string) {
	const starting =
		state.enforceOrder &&
		state.steps.some((item) => item.id === 'red' && item.status === 'pending');
	if (state.regressionCommits !== 1 && !starting) return;
	await requireRegressionProof(root, state.name, step);
	if (starting && step === 'red') state.regressionCommits = 1;
}

function regressionRequest(input: RecordRegressionInput, red?: RegressionRecord) {
	if (red) {
		if (
			[input.command, input.assertion, ...(input.test ?? []), ...(input.unit ?? [])].some(Boolean)
		)
			fail(
				'The fix must use the same command, tests, units and assertion from the failing record.'
			);
		return { tests: red.tests, units: red.units, command: red.command, assertion: red.assertion };
	}
	return newRegressionRequest(input);
}

function newRegressionRequest(input: RecordRegressionInput) {
	const command = input.command?.trim(),
		assertion = input.assertion?.trim();
	if (!command || !assertion) return fail('Name --command and the actual failed --assertion.');
	return {
		tests: [...new Set(input.test ?? [])].sort(),
		units: [...new Set(input.unit ?? [])].sort(),
		command,
		assertion
	};
}

function regressionTimeout(value?: string): number {
	const result = Number(value ?? '600000');
	if (!Number.isSafeInteger(result) || result < 1 || result > 3_600_000)
		fail('Regression timeout must be between 1 and 3600000 milliseconds.');
	return result;
}

async function declaredUnits(root: string, commit: string, units: string[]) {
	if (!units.length) return undefined;
	const registry = await new UnitRegistryRepository(root).read(
		await CommitTreeAdapter.open(root, commit)
	);
	if (registry.errors.length) fail('Repair the unit registry before recording component proof.');
	const known = new Set(
		registry.manifests.filter((unit) => unit.status === 'active').map((unit) => unit.id)
	);
	if (units.some((id) => !known.has(id))) fail('Every --unit must be active at the tested commit.');
	return registry.manifests.map((unit) => unit.id);
}

export type { RecordRegressionInput } from './recordRegression.types';
