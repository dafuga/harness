import type { Queue, Groups, Case } from './command.execution-runtimes-jobs-command-jobs-output.test.types';
import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { jobDuration, printJobEta, printJobStats } from '../../src/commands/execution-runtimes/jobs-command/jobsOutput';

const UNIT_ID = 'command.execution-runtimes-jobs-command-jobs-output';

const queue = {
	status: 'estimated' as const,
	queued: 2,
	running: 1,
	slots: { local: 2 },
	p50Ms: 120000,
	p90Ms: 300000,
	finish: { p50: '2026-11-17 11:02 Europe/Lisbon', p90: '2026-11-17 11:05 Europe/Lisbon' },
	estimates: [
		{ type: 'build', model: 'node', count: 12, fallback: false, medianMs: 90000, p90Ms: 180000 },
		{ type: 'test', model: 'bun', count: 0, fallback: true, medianMs: null, p90Ms: null }
	],
	warnings: ['sample scope is limited to this repository']
} as unknown as Queue;

const groups = [
	{ type: 'build', model: 'node', count: 12, meanMs: 95000, medianMs: 90000, p80Ms: 150000, p90Ms: 180000 }
] as Groups;

function record(symbol: string, state: string, cases: Case[]): void {
	recordExampleCases({ unitId: UNIT_ID, symbol, state, evidence: 'examples-cases', file: `${state}.json` }, cases);
}

function captureLog(run: () => void): string[] {
	const lines: string[] = [];
	const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
		lines.push(args.map(String).join(' '));
	});
	try {
		run();
	} finally {
		spy.mockRestore();
	}
	return lines;
}

test('Formats durations as hours, minutes and rounded-up seconds', () => {
	const inputs = [null, 0, 1500, 3723000];
	const outputs = inputs.map((ms) => jobDuration(ms));

	expect(outputs).toEqual(['unknown', '0h 0m 0s', '0h 0m 2s', '1h 2m 3s']);
	record(
		'jobDuration',
		'formats-durations-as-hours-minutes-and-rounded-up-seconds',
		inputs.map((ms, index) => ({ name: `${ms ?? 'null'} ms`, input: ms, output: outputs[index] }))
	);
});

test('Prints a queue estimate with fallback notes', () => {
	const lines = captureLog(() => printJobEta(queue));

	expect(lines).toEqual([
		'Queue ETA: estimated; 2 queued + 1 running',
		'Slots: {"local":2}',
		'Remaining (p50–p90 duration scenarios): 0h 2m 0s – 0h 5m 0s',
		'Finish: 2026-11-17 11:02 Europe/Lisbon – 2026-11-17 11:05 Europe/Lisbon',
		'  build/node: 12 samples; fallback=false; median=0h 1m 30s, p90=0h 3m 0s',
		'  test/bun: 0 samples; fallback=true; median=unknown, p90=unknown',
		'Note: sample scope is limited to this repository'
	]);
	record('printJobEta', 'prints-a-queue-estimate-with-fallback-notes', [
		{ name: 'estimated queue with one fallback estimate', input: queue, output: { lines } }
	]);
});

test('Prints observed duration statistics per type and model', () => {
	const lines = captureLog(() => printJobStats(groups));

	expect(lines).toEqual([
		'Type / Model | Samples | Mean | Median | p80 | p90',
		'build / node | 12 | 0h 1m 35s | 0h 1m 30s | 0h 2m 30s | 0h 3m 0s'
	]);
	record('printJobStats', 'prints-observed-duration-statistics-per-type-and-model', [
		{ name: 'one build/node group with 12 samples', input: groups, output: { lines } }
	]);
});

test('Prints a hint when there are no duration samples', () => {
	const lines = captureLog(() => printJobStats([]));

	expect(lines).toEqual([
		'Type / Model | Samples | Mean | Median | p80 | p90',
		'No completed duration samples; use jobs backfill or jobs record.'
	]);
	record('printJobStats', 'prints-a-hint-when-there-are-no-duration-samples', [
		{ name: 'empty groups list', input: [], output: { lines } }
	]);
});
