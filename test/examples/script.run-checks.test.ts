import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { checkSteps, runSteps } from '../../scripts/run-checks';

const successfulState = 'runs-steps-in-order-and-reports-elapsed-time';
const failureState = 'stops-at-first-failure-and-converts-runner-errors';
const reporterState = 'rejects-when-the-reporter-throws';

function reportSummary(lines: string[]): { starts: string[]; completions: string[] } {
	return {
		starts: lines.filter((line) => line.startsWith('[check ')),
		completions: lines.filter((line) => line.startsWith('[check]'))
	};
}

test('Runs steps in order and reports elapsed time', async () => {
	const visited: string[] = [];
	const lines: string[] = [];
	const status = await runSteps(
		['typecheck', 'lint'],
		async (name) => {
			visited.push(name);
			return 0;
		},
		(line) => lines.push(line)
	);
	expect(status).toBe(0);
	expect(visited).toEqual(['typecheck', 'lint']);
	expect(lines[1]).toMatch(/\[check\] typecheck: passed in \d+\.\d ms/);
	const emptyVisited: string[] = [];
	const emptyStatus = await runSteps([], async (name) => {
		emptyVisited.push(name);
		return 0;
	}, () => undefined);
	expect(emptyStatus).toBe(0);
	expect(emptyVisited).toEqual([]);
	expect(checkSteps).toHaveLength(24);
	recordExampleCases(
		{
			unitId: 'script.run-checks',
			symbol: 'runSteps',
			state: successfulState,
			evidence: 'examples-cases',
			file: `${successfulState}.json`
		},
		[
			{
				name: 'runs two named steps successfully',
				input: ['typecheck', 'lint'],
				output: { status, visited, reports: reportSummary(lines) }
			},
			{
				name: 'empty list succeeds without invoking runner',
				input: [],
				output: { status: emptyStatus, visited: emptyVisited }
			},
			{
				name: 'exports broad-check sequence',
				input: 'checkSteps',
				output: { count: checkSteps.length, first: checkSteps[0], last: checkSteps.at(-1) }
			}
		]
	);
});

test('Stops at first failure and converts runner errors', async () => {
	const visited: string[] = [];
	const lines: string[] = [];
	const status = await runSteps(
		['typecheck', 'lint', 'build'],
		async (name) => {
			visited.push(name);
			return name === 'lint' ? 2 : 0;
		},
		(line) => lines.push(line)
	);
	expect(status).toBe(2);
	expect(visited).toEqual(['typecheck', 'lint']);
	const rejectedVisited: string[] = [];
	const rejectedStatus = await runSteps(['format:check', 'build'], async (name) => {
		rejectedVisited.push(name);
		if (name === 'format:check') throw new Error('launcher failed');
		return 0;
	}, () => undefined);
	expect(rejectedStatus).toBe(1);
	expect(rejectedVisited).toEqual(['format:check']);
	recordExampleCases(
		{
			unitId: 'script.run-checks',
			symbol: 'runSteps',
			state: failureState,
			evidence: 'examples-cases',
			file: `${failureState}.json`
		},
		[
			{
				name: 'returns first nonzero status and stops',
				input: ['typecheck', 'lint', 'build'],
				output: { status, visited, reports: reportSummary(lines) }
			},
			{
				name: 'converts a thrown runner error to status one',
				input: ['format:check', 'build'],
				output: { status: rejectedStatus, visited: rejectedVisited }
			}
		]
	);
});

test('Rejects when the reporter throws', async () => {
	let errorMessage = '';
	try {
		await runSteps(['typecheck'], async () => 0, () => {
			throw new Error('report unavailable');
		});
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error);
	}
	expect(errorMessage).toBe('report unavailable');
	recordExampleCases(
		{
			unitId: 'script.run-checks',
			symbol: 'runSteps',
			state: reporterState,
			evidence: 'examples-cases',
			file: `${reporterState}.json`
		},
		[
			{
				name: 'propagates reporter error',
				input: { steps: ['typecheck'], reporterError: 'report unavailable' },
				error: { name: 'Error', message: errorMessage }
			}
		]
	);
});
