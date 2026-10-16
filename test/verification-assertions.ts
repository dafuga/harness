import { z } from 'zod';
import { resolve } from 'node:path';
import type { VerificationTarget } from './verification-targets';

const observation = z.strictObject({
	schemaVersion: z.literal(1),
	kind: z.literal('matcher'),
	invocation: z.string(),
	testName: z.string().min(1),
	matcher: z.string().min(1),
	modifiers: z.array(z.string()),
	actual: z.json(),
	expected: z.array(z.json()),
	passed: z.boolean(),
	error: z.json().optional()
});
const complete = z.strictObject({
	schemaVersion: z.literal(1),
	invocation: z.string(),
	testName: z.string().min(1),
	kind: z.literal('complete'),
	observed: z.number().int().nonnegative(),
	started: z.number().int().nonnegative(),
	completed: z.number().int().nonnegative(),
	assertionCalls: z.number().int().nonnegative()
});
const reportSchema = z.object({
	success: z.literal(true),
	numTotalTests: z.number().int().positive(),
	numPassedTests: z.number().int().positive(),
	numFailedTests: z.literal(0),
	numPendingTests: z.literal(0),
	numTodoTests: z.literal(0),
	testResults: z
		.array(
			z.object({
				name: z.string(),
				status: z.literal('passed'),
				assertionResults: z
					.array(
						z.object({
							fullName: z.string(),
							status: z.literal('passed'),
							failureMessages: z.array(z.string()).length(0)
						})
					)
					.min(1)
			})
		)
		.length(1)
});
export interface AssertionInput {
	report: unknown;
	observations: string;
	invocation: string;
	cwd: string;
	status: number | null;
}
/** Runner success alone is insufficient: each expected test must have complete actual observations. */
export function verifiedAssertions(target: VerificationTarget, input: AssertionInput) {
	if (input.status !== 0)
		throw new Error('Failed or incomplete runner cannot report passed behavior');
	const report = reportSchema.parse(input.report);
	const suite = report.testResults[0];
	const names = suite.assertionResults.map((test) => test.fullName);
	const expected = Object.keys(target.tests);
	if (
		suite.name !== resolve(input.cwd, target.target) ||
		report.numTotalTests !== expected.length ||
		report.numPassedTests !== expected.length ||
		names.length !== expected.length ||
		new Set(names).size !== names.length ||
		expected.some((name) => !names.includes(name))
	) {
		throw new Error('Runner report does not contain exactly the permitted tests');
	}
	const records = input.observations
		.split('\n')
		.filter(Boolean)
		.map((line) => z.union([observation, complete]).parse(JSON.parse(line)))
		.filter((line) => line.invocation === input.invocation);
	if (records.some((line) => !names.includes(line.testName)))
		throw new Error('Unrelated matcher observation');
	return names.map((name) => {
		const entries = records.filter((line) => line.testName === name);
		const matchers = entries.filter((line) => 'matcher' in line);
		const endings = entries.filter((line) => line.kind === 'complete');
		const ending = endings[0];
		if (
			endings.length !== 1 ||
			!ending ||
			matchers.length === 0 ||
			ending.observed !== matchers.length ||
			ending.started !== matchers.length ||
			ending.completed !== matchers.length ||
			ending.assertionCalls !== matchers.length ||
			matchers.some((line) => !line.passed)
		)
			throw new Error(`Incomplete matcher observations: ${name}`);
		return { state: target.tests[name], test: name, status: 'passed', observations: matchers };
	});
}
