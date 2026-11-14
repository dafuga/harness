import { expect, test } from 'vitest';
import { unitsConfigSchema } from '../../src/core/unitsConfig';
import { verifyConfigSchema, type VerifyConfig } from '../../src/core/verifyTypes';
import { verifyPlan } from '../../src/services/verification-service/verifyPlan';

const unitsConfig = unitsConfigSchema.parse({
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/'],
	global: [],
	ignored: [],
	references: []
});
const own = 'test/own.test.ts';

/**
 * A config object in the shape the exported type had before verify profiles and capture caps:
 * no `profiles`, no `maxCaptureBytes`, no `maxRecordBytes`. It must keep satisfying the type.
 */
const oldShape: VerifyConfig = {
	schemaVersion: 1,
	setup: [],
	link: [],
	outputs: [],
	builds: [],
	tools: [],
	checks: [{ path: own, command: 'bun x vitest run {target} --reporter=dot', timeoutMs: 9_000 }],
	runners: { vitest: 'bun x vitest run {target}', playwright: 'bun x playwright test {target}' },
	timeouts: { test: 5_000 }
};

const plan = (config: VerifyConfig) =>
	verifyPlan({ selectedTests: [own, 'test/case.test.ts'], scenarios: [], config, unitsConfig }).map(
		({ id, command, timeoutMs }) => ({ id, command, timeoutMs })
	);

const expected = [
	{ id: 'test/case.test.ts', command: 'bun x vitest run test/case.test.ts', timeoutMs: 5_000 },
	{ id: own, command: 'bun x vitest run test/own.test.ts --reporter=dot', timeoutMs: 9_000 }
];

test('a config object written before profiles and capture caps plans as it did', () => {
	expect(plan(oldShape)).toEqual(expected);
});

test('an old harness.verify.json without the new keys loads with the defaults applied', () => {
	const parsed = verifyConfigSchema.parse(JSON.parse(JSON.stringify(oldShape)));
	expect(parsed.profiles).toEqual({});
	expect(parsed.maxCaptureBytes).toBeUndefined();
	expect(parsed.maxRecordBytes).toBeUndefined();
	expect(parsed.checks).toEqual(oldShape.checks);
	expect(plan(parsed)).toEqual(expected);
	// What parsing returns is still a VerifyConfig, so loaders keep their signature.
	const loaded: VerifyConfig = parsed;
	expect(loaded.timeouts.test).toBe(5_000);
});
