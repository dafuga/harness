import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { verificationTarget } from './verification-targets';
import { verifiedAssertions, type AssertionInput } from './verification-assertions';

const cwd = '/fixture/packages/planning';
const target = verificationTarget(
	'planning-artifacts',
	'vitest',
	'test/utils/plan-data.test.ts',
	cwd
);
const name = Object.keys(target.tests)[0];
function valid(): AssertionInput {
	return {
		cwd,
		status: 0,
		invocation: 'current',
		report: {
			success: true,
			numTotalTests: 1,
			numPassedTests: 1,
			numFailedTests: 0,
			numPendingTests: 0,
			numTodoTests: 0,
			testResults: [
				{
					name: `${cwd}/${target.target}`,
					status: 'passed',
					assertionResults: [{ fullName: name, status: 'passed', failureMessages: [] }]
				}
			]
		},
		observations: [
			{
				schemaVersion: 1,
				kind: 'matcher',
				invocation: 'current',
				testName: name,
				matcher: 'toBe',
				modifiers: [],
				actual: 'canonical',
				expected: ['canonical'],
				passed: true
			},
			{
				schemaVersion: 1,
				kind: 'complete',
				invocation: 'current',
				testName: name,
				observed: 1,
				started: 1,
				completed: 1,
				assertionCalls: 1
			}
		]
			.map((line) => JSON.stringify(line))
			.join('\n')
	};
}
test('known runner observes only its own permitted state, never every scenario state', () => {
	const results = verifiedAssertions(target, valid());
	expect(results.map((item) => item.state)).toEqual(['repository-isolation']);
	expect(target.states).not.toContain('immutable-history');
	expect(results[0].observations[0]).toMatchObject({
		actual: 'canonical',
		expected: ['canonical']
	});
});
test('unknown scenario, target, runner and package fail closed', () => {
	for (const [scenario, runner, file, directory] of [
		['desktop-renderer', 'vitest', target.target, cwd],
		['planning-artifacts', 'vitest', 'test/other.test.ts', cwd],
		['planning-artifacts', 'playwright', target.target, cwd],
		['planning-artifacts', 'vitest', target.target, '/fixture/packages/desktop']
	])
		expect(() => verificationTarget(scenario, runner, file, directory)).toThrow('Unknown');
});
test('missing or partially recorded assertions cannot satisfy a behavior state', () => {
	for (const observations of [
		'',
		valid().observations.split('\n')[0],
		valid().observations.split('\n')[1],
		valid().observations.replace('"observed":1', '"observed":2'),
		valid().observations.replace('"assertionCalls":1', '"assertionCalls":2'),
		valid().observations.replaceAll('"current"', '"earlier-run"'),
		'{malformed'
	]) {
		expect(() => verifiedAssertions(target, { ...valid(), observations })).toThrow();
	}
});
test('failed runners or matchers cannot report passed behavior despite a success-shaped report', () => {
	expect(() => verifiedAssertions(target, { ...valid(), status: 1 })).toThrow('Failed');
	expect(() => verifiedAssertions(target, { ...valid(), status: null })).toThrow('Failed');
	expect(() =>
		verifiedAssertions(target, {
			...valid(),
			observations: valid().observations.replace('"passed":true', '"passed":false')
		})
	).toThrow('Incomplete');
});
test('partial or unrelated successful test files cannot populate the mapped state', () => {
	const full = verificationTarget(
		'planning-artifacts',
		'vitest',
		'test/planning-canonical.test.ts',
		cwd
	);
	expect(() => verifiedAssertions(full, valid())).toThrow('exactly');
	const input = valid();
	input.report = { ...(input.report as object), numPendingTests: 1 };
	expect(() => verifiedAssertions(target, input)).toThrow();
	expect(() =>
		verifiedAssertions(target, {
			...valid(),
			observations: valid().observations.replaceAll(name, 'unrelated test')
		})
	).toThrow('Unrelated');
});

test('an unrelated verification command exits before running and creates no capture slots', () => {
	const directory = mkdtempSync(join(tmpdir(), 'harness-output-boundary-'));
	try {
		const result = spawnSync(
			'bun',
			[resolve('test/verification-output.ts'), 'vitest', 'test/utils/plan-data.test.ts'],
			{
				cwd: resolve('packages/planning'),
				encoding: 'utf8',
				env: {
					...process.env,
					HARNESS_SCENARIO: 'desktop-renderer',
					HARNESS_EVIDENCE_DIR: directory
				}
			}
		);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain('Unknown verification scenario');
		expect(readdirSync(directory)).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
