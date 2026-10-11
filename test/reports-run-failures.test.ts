import { expect, test } from 'vitest';
import { runPassed } from './support/browserRun';
import { runFailures, type RunReport } from './support/runFailures';

const red = String.fromCharCode(27) + '[31m';
const plain = String.fromCharCode(27) + '[39m';
const assertion =
	`Error: ${red}expect(${plain}locator).toHaveCount(expected) failed\n\n` +
	"Locator:  getByRole('region', { name: 'Earlier reports' }).locator('.evidence-card')\n" +
	'Expected: 1\nReceived: 0';
const passing = { status: 'expected', results: [{ errors: [] }] };
const report: RunReport = {
	suites: [
		{
			specs: [
				{
					title: 'earlier reports keep their outcome, date and the revision they recorded',
					file: 'harness-legacy.spec.ts',
					line: 6,
					tests: [
						{
							status: 'unexpected',
							results: [
								{ errors: [{ message: assertion }, { message: 'Error: a later one' }] },
								{ errors: [{ message: 'Error: what a retry said' }] }
							]
						}
					]
				}
			]
		},
		{
			specs: [
				{ title: 'a passing one', file: 'harness-routes.spec.ts', line: 15, tests: [passing] }
			],
			suites: [
				{
					specs: [
						{
							title: 'inside a group',
							file: 'project-reports.spec.ts',
							line: 20,
							tests: [
								{ status: 'unexpected', results: [{ error: { message: 'Error: timed out' } }] }
							]
						}
					]
				}
			]
		}
	]
};

test('a failed run names each failed test with the first error it raised, without colour codes', () => {
	const [first, second, ...rest] = runFailures(report);
	expect(first).toBe(
		'harness-legacy.spec.ts:6 › earlier reports keep their outcome, date and the revision they recorded\n' +
			'Error: expect(locator).toHaveCount(expected) failed\n\n' +
			"Locator:  getByRole('region', { name: 'Earlier reports' }).locator('.evidence-card')\n" +
			'Expected: 1\nReceived: 0'
	);
	expect(second).toBe('project-reports.spec.ts:20 › inside a group\nError: timed out');
	expect(rest).toEqual([]);
});

test('a run that failed outside any test says what stopped it, and a clean report says nothing', () => {
	const stopped = { errors: [{ message: 'Error: Process from config.webServer exited early.' }] };
	expect(runFailures(stopped)).toEqual(['Error: Process from config.webServer exited early.']);
	expect(runFailures({ suites: [{ specs: [] }] })).toEqual([]);
	expect(runFailures({})).toEqual([]);
});

test('the error of a failed run carries its first failing assertion, which its output leaves out', async () => {
	const output =
		'[1/28] tests/e2e/harness-legacy.spec.ts:6:1 › earlier reports\n  1 failed\n  27 passed';
	const run = {
		finished: Promise.resolve(1),
		failures: () => runFailures(report),
		output: () => output
	};
	const failure = await runPassed(run, 'second').catch((error: Error) => error.message);
	expect(failure).toContain('The second run exited 1.');
	expect(failure).toContain('Expected: 1\nReceived: 0');
	expect(output).not.toContain('Received: 0');
	// The assertion comes first; the end of the output follows it.
	expect(failure?.indexOf('Received: 0')).toBeLessThan(failure?.indexOf('27 passed') ?? 0);

	const silent = { finished: Promise.resolve(1), failures: () => [], output: () => 'crashed' };
	await expect(runPassed(silent, 'first')).rejects.toThrow('It reported no failed test.');
	await expect(
		runPassed({ ...silent, finished: Promise.resolve(0) }, 'first')
	).resolves.toBeUndefined();
});
