import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	verifyConfigSchema,
	defaultVerifyConfig,
	workloadSchema
} from '../../src/core/verification-evidence/verifyTypes';

test('Returns the default verify config with its runner templates', () => {
	const output = defaultVerifyConfig;
	expect(output.schemaVersion).toBe(1);
	expect(output.setup).toEqual([]);
	expect(output.link).toEqual([]);
	expect(output.outputs).toEqual([]);
	expect(output.builds).toEqual([]);
	expect(output.tools).toEqual([]);
	expect(output.profiles).toEqual({});
	expect(output.checks).toEqual([]);
	expect(output.runners).toEqual({
		vitest: 'bun x vitest run {target}',
		playwright: 'bun x playwright test {target}'
	});
	expect(output.timeouts.test).toBe(600000);

	recordExampleCases(
		{
			unitId: 'function.verify-types',
			symbol: 'defaultVerifyConfig',
			state: 'returns-the-default-verify-config-with-its-runner-templates',
			evidence: 'examples-cases',
			file: 'returns-the-default-verify-config-with-its-runner-templates.json'
		},
		[{ name: 'default verify config', input: null, output }]
	);
});

test('Parses a minimal config and fills its defaults', () => {
	const input = {
		schemaVersion: 1,
		setup: [],
		link: [],
		runners: { vitest: 'bun x vitest run {target}' },
		timeouts: { test: 600000 }
	};
	const parsed = verifyConfigSchema.parse(input);
	expect(parsed.outputs).toEqual([]);
	expect(parsed.builds).toEqual([]);
	expect(parsed.tools).toEqual([]);
	expect(parsed.profiles).toEqual({});
	expect(parsed.checks).toEqual([]);
	expect(parsed.runners.vitest).toBe('bun x vitest run {target}');

	const output = {
		outputs: parsed.outputs,
		builds: parsed.builds,
		tools: parsed.tools,
		profiles: parsed.profiles,
		checks: parsed.checks
	};
	recordExampleCases(
		{
			unitId: 'function.verify-types',
			symbol: 'verifyConfigSchema',
			state: 'parses-a-minimal-config-and-fills-its-defaults',
			evidence: 'examples-cases',
			file: 'parses-a-minimal-config-and-fills-its-defaults.json'
		},
		[{ name: 'minimal config with a vitest runner', input, output }]
	);
});

test('Rejects a config with an unknown key', () => {
	const input = {
		schemaVersion: 1,
		setup: [],
		link: [],
		runners: {},
		timeouts: { test: 1000 },
		surprise: true
	};
	const result = verifyConfigSchema.safeParse(input);
	expect(result.success).toBe(false);
	const issues = result.success
		? []
		: result.error.issues.map((issue) => ({ code: issue.code, path: issue.path }));
	expect(issues.length).toBeGreaterThan(0);
	expect(issues[0]?.code).toBe('unrecognized_keys');

	recordExampleCases(
		{
			unitId: 'function.verify-types',
			symbol: 'verifyConfigSchema',
			state: 'rejects-a-config-with-an-unknown-key',
			evidence: 'examples-cases',
			file: 'rejects-a-config-with-an-unknown-key.json'
		},
		[{ name: 'unknown top-level key "surprise"', input, error: { issues } }]
	);
});

test('Accepts a workload within the round and iteration limits', () => {
	const input = {
		schemaVersion: 1,
		id: 'function.verify-types',
		request: { operation: 'invoice.create', input: { amount: 12 } },
		rounds: 3,
		iterations: 100
	};
	const parsed = workloadSchema.parse(input);
	expect(parsed.rounds).toBe(3);
	expect(parsed.iterations).toBe(100);

	const tooMany = workloadSchema.safeParse({ ...input, iterations: 100001 });
	expect(tooMany.success).toBe(false);
	const error = tooMany.success
		? null
		: tooMany.error.issues.map((issue) => ({ code: issue.code, path: issue.path }));
	expect(error?.[0]?.path).toEqual(['iterations']);

	recordExampleCases(
		{
			unitId: 'function.verify-types',
			symbol: 'workloadSchema',
			state: 'accepts-a-workload-within-the-round-and-iteration-limits',
			evidence: 'examples-cases',
			file: 'accepts-a-workload-within-the-round-and-iteration-limits.json'
		},
		[
			{
				name: 'three rounds of 100 iterations',
				input,
				output: { id: parsed.id, rounds: parsed.rounds, iterations: parsed.iterations }
			},
			{
				name: 'iterations above 100000 are rejected',
				input: { ...input, iterations: 100001 },
				error: { issues: error }
			}
		]
	);
});
