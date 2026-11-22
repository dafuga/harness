import { test } from 'vitest';
import { mkdir } from 'node:fs/promises';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	loopPaths,
	writeNewLoop,
	readLoop,
	writeLoop,
	appendTrace,
	validateLoopId,
	validateRequiredText,
	timestamp,
	isMissingFile
} from '../../src/workflows/development-tooling/loop-state/loopState';
import type { LoopState } from '../../src/workflows/development-tooling/loop-state/loopState.types';

const sampleLoop = (): LoopState => ({
	name: 'release-tracker',
	goal: 'Track the release checklist',
	createdAt: '2026-11-15T12:00:00.000Z',
	updatedAt: '2026-11-15T12:00:00.000Z',
	steps: [{ id: 'prepare', title: 'Prepare release', status: 'pending' }]
});

test('Creates and reads a loop state', async () => {
	await withTempDir('loop-state-create-', async (root) => {
		const paths = loopPaths(root, 'release-tracker');
		const state = sampleLoop();
		await writeNewLoop(paths, state);
		const loaded = await readLoop(paths.state);
		expect(loaded).toEqual(state);
		recordExampleCases(
			{
				unitId: 'workflow.loop-state',
				symbol: 'writeNewLoop',
				state: 'creates-and-reads-a-loop-state',
				evidence: 'examples-cases',
				file: 'creates-and-reads-a-loop-state.json'
			},
			[{ name: 'creates the loop directory and stores its state', input: { paths, state }, output: loaded }]
		);
	});
});

test('Writes formatted state and appends a trace event', async () => {
	await withTempDir('loop-state-write-', async (root) => {
		const paths = loopPaths(root, 'release-tracker');
		const state = sampleLoop();
		await mkdir(paths.dir, { recursive: true });
		await writeLoop(paths.state, state);
		await appendTrace(paths.trace, { type: 'step-started', step: 'prepare' });
		const loaded = await readLoop(paths.state);
		expect(loaded.name).toBe('release-tracker');
		recordExampleCases(
			{
				unitId: 'workflow.loop-state',
				symbol: 'appendTrace',
				state: 'writes-formatted-state-and-appends-a-trace-event',
				evidence: 'examples-cases',
				file: 'writes-formatted-state-and-appends-a-trace-event.json'
			},
			[{ name: 'writes the state and one compact trace line', input: { paths, state, event: { type: 'step-started', step: 'prepare' } }, output: { state: loaded, trace: '{"type":"step-started","step":"prepare"}\n' } }]
		);
	});
});

test('Validates loop identifiers and required text', () => {
	const id = validateLoopId(' release-tracker ', 'loop ID');
	const goal = validateRequiredText('  Track the release checklist  ', 'goal');
	expect(id).toBe('release-tracker');
	expect(goal).toBe('Track the release checklist');
	recordExampleCases(
		{
			unitId: 'workflow.loop-state',
			symbol: 'validateLoopId',
			state: 'validates-loop-identifiers-and-required-text',
			evidence: 'examples-cases',
			file: 'validates-loop-identifiers-and-required-text.json'
		},
		[{ name: 'trims a valid id and required goal', input: { id: ' release-tracker ', goal: '  Track the release checklist  ' }, output: { id, goal } }]
	);
});

test('Uses the supplied clock and recognizes missing files', () => {
	const time = timestamp(() => '2026-11-15T12:00:00.000Z');
	const missing = isMissingFile(Object.assign(new Error('missing'), { code: 'ENOENT' }));
	expect(time).toBe('2026-11-15T12:00:00.000Z');
	expect(missing).toBe(true);
	recordExampleCases(
		{
			unitId: 'workflow.loop-state',
			symbol: 'timestamp',
			state: 'uses-the-supplied-clock-and-recognizes-missing-files',
			evidence: 'examples-cases',
			file: 'uses-the-supplied-clock-and-recognizes-missing-files.json'
		},
		[{ name: 'returns the callback value and detects ENOENT', input: { clockValue: time, errorCode: 'ENOENT' }, output: { timestamp: time, missing } }]
	);
});
