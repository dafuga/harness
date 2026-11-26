import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { buildObservation, finishObservation } from '../../scripts/ios-build-observation';
import type { BuildObservation } from '../../scripts/ios-build-observation.types';
import type { Case } from './desktop.script.ios-build-observation.test.types';

const UNIT = 'desktop.script.ios-build-observation';
const OBSERVATION_FAILED =
	'Build process observation failed; shared or unknown processes were not signalled.';
const SETTLEMENT_FAILED =
	'Build process settlement failed; shared or unknown processes were not signalled.';

function record(state: string, symbol: string, cases: Case[]): void {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function summary(error: unknown): { name: string; message: string } | string {
	return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}

async function caught(run: Promise<unknown>): Promise<unknown> {
	try {
		await run;
		return undefined;
	} catch (error) {
		return error;
	}
}

test('Returns the settled value once the probe confirms', async () => {
	const observation = buildObservation(() => Promise.resolve(true));
	const probe = await observation.look();
	const result = await finishObservation(
		() => Promise.resolve('signalled 2 builds'),
		[observation]
	);
	const lookAfter = await observation.look();

	expect(probe).toBe(true);
	expect(result).toBe('signalled 2 builds');
	expect(lookAfter).toBe(false);

	record('returns-the-settled-value-once-the-probe-confirms', 'finishObservation', [
		{ name: 'probe resolves true, settle resolves', input: 'probe true', output: result },
		{ name: 'look after finish is closed', input: 'probe true', output: lookAfter }
	]);
});

test('Reports observation failure when the probe is false', async () => {
	const observation = buildObservation(() => Promise.resolve(false));
	let settled = false;
	const result = await finishObservation(() => {
		settled = true;
		return Promise.resolve('never returned');
	}, [observation]);

	expect(result).toBe(OBSERVATION_FAILED);
	expect(settled).toBe(false);

	record('reports-observation-failure-when-the-probe-is-false', 'finishObservation', [
		{ name: 'probe resolves false, settle skipped', input: 'probe false', output: result }
	]);
});

test('Reports settlement failure when settle rejects', async () => {
	const observation = buildObservation(() => Promise.resolve(true));
	const result = await finishObservation(
		() => Promise.reject(new Error('signal refused')),
		[observation]
	);

	expect(result).toBe(SETTLEMENT_FAILED);

	record('reports-settlement-failure-when-settle-rejects', 'finishObservation', [
		{ name: 'settle rejects after a true probe', input: 'settle rejects', output: result }
	]);
});

test('Stops probing after a rejected read and resolves false', async () => {
	let calls = 0;
	const observation = buildObservation(() => {
		calls += 1;
		return Promise.reject(new Error('probe broke'));
	});
	const first = await observation.look();
	const second = await observation.look();
	observation.close();

	expect(first).toBe(false);
	expect(second).toBe(false);
	expect(calls).toBe(1);

	record('stops-probing-after-a-rejected-read-and-resolves-false', 'buildObservation', [
		{ name: 'first look after a rejected read', input: 'read rejects', output: first },
		{ name: 'second look does not probe again', input: 'read rejects', output: second },
		{ name: 'reads made after the rejection', input: 'read rejects', output: calls }
	]);
});

test('Rejects with a TypeError for a null observation entry', async () => {
	const observation = buildObservation(() => Promise.resolve(true));
	const error = await caught(
		finishObservation(
			() => Promise.resolve('done'),
			[observation, null as unknown as BuildObservation]
		)
	);

	expect(error).toBeInstanceOf(TypeError);

	record('rejects-with-a-typeerror-for-a-null-observation-entry', 'finishObservation', [
		{
			name: 'null entry after a true probe',
			input: 'reads [observation, null]',
			error: summary(error)
		}
	]);
});
