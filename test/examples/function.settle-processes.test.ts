import type { Outcome, Cases } from './function.settle-processes.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { haltProcesses, settleProcesses } from '../../src/utils/reports-media/run-isolated/settleProcesses';
import type { SettleTiming } from '../../src/utils/reports-media/settleProcesses';

const group = 4242;
const context = { authority: () => null, group };
const quiet = { alive: () => Promise.resolve([]) };
const unreadable = { alive: () => Promise.resolve(null) };
const timing: SettleTiming = { settleMs: 0, graceMs: 0, cleanupMs: 2000 };

/** A deadline that never expires and never waits, so no timers run. */
function deadline() {
	return {
		signal: new AbortController().signal,
		expired: () => false,
		within: <T>(work: Promise<T>) => work,
		pause: () => Promise.resolve(),
		cancel: () => undefined
	};
}

function summary(settlement: Outcome) {
	return {
		survivors: settlement.survivors,
		stopped: settlement.stopped,
		resisted: settlement.resisted,
		unknown: settlement.unknown
	};
}

function record(state: string, symbol: string, cases: Cases) {
	return recordExampleCases(
		{
			unitId: 'function.settle-processes',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Settles quietly when the command leaves no processes', async () => {
	const settlement = await settleProcesses(quiet, context, timing);
	const result = summary(settlement);
	expect(result).toEqual({ survivors: [], stopped: 0, resisted: 0, unknown: false });
	record('settles-quietly-when-the-command-leaves-no-processes', 'settleProcesses', [
		{
			name: 'command group has no followed processes',
			input: { settleMs: 0, graceMs: 0, cleanupMs: 2000 },
			output: result
		}
	]);
});

test('Reports unknown settlement when the table is unreadable', async () => {
	const settlement = await settleProcesses(unreadable, context, timing);
	const result = summary(settlement);
	expect(result).toMatchObject({ survivors: [], stopped: 0, unknown: true });
	expect(settlement.report).toContain('could not be read');
	record('reports-unknown-settlement-when-the-table-is-unreadable', 'settleProcesses', [
		{
			name: 'followed processes cannot be read',
			input: { settleMs: 0, graceMs: 0, cleanupMs: 2000 },
			output: result
		}
	]);
});

test('Halts nothing when the process table is unreadable', async () => {
	const result = await haltProcesses(unreadable, context, { graceMs: 0, deadline: deadline() });
	expect(result).toBeUndefined();
	record('halts-nothing-when-the-process-table-is-unreadable', 'haltProcesses', [
		{
			name: 'halt observation returns null',
			input: { graceMs: 0 },
			output: null
		}
	]);
});
