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

/** `oldShape` with these setup steps and one declared build, `reports`. */
const withSetup = (setup: unknown[]) => ({
	...oldShape,
	builds: [{ id: 'reports', directory: 'packages/reports/build' }],
	setup
});

test('a setup step may name the builds it produces, and the names survive parsing', () => {
	const parsed = verifyConfigSchema.parse(
		withSetup([{ command: 'bun run build', timeoutMs: 1_000, builds: ['reports'] }])
	);
	expect(parsed.setup).toEqual([
		{ command: 'bun run build', timeoutMs: 1_000, builds: ['reports'] }
	]);
});

test('a setup step naming an undeclared build is rejected, and the message names it', () => {
	const rejected = verifyConfigSchema.safeParse(
		withSetup([{ command: 'bun run build', builds: ['reports', 'planing'] }])
	);
	expect(rejected.success).toBe(false);
	expect(rejected.error?.issues).toEqual([
		expect.objectContaining({
			path: ['setup', 0, 'builds'],
			message: expect.stringContaining('"planing"')
		})
	]);
});

test('setup steps without builds still parse, and gain no builds key', () => {
	const parsed = verifyConfigSchema.parse(
		withSetup([
			{ command: 'bun install --frozen-lockfile' },
			{ command: 'bun run build', timeoutMs: 1_000 }
		])
	);
	expect(parsed.setup).toEqual([
		{ command: 'bun install --frozen-lockfile' },
		{ command: 'bun run build', timeoutMs: 1_000 }
	]);
	for (const step of parsed.setup) expect(step).not.toHaveProperty('builds');
});
