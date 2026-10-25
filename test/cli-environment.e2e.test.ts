import { afterEach, expect, test, vi } from 'vitest';
import { runCommand } from './support/cli';

const context = [
	'HARNESS_VERIFY',
	'HARNESS_VERIFY_REVISION',
	'HARNESS_VERIFY_TREE',
	'HARNESS_VERIFY_PROFILE',
	'HARNESS_SCENARIO',
	'HARNESS_EVIDENCE_DIR',
	'TAKE_SCREENSHOT',
	'HARNESS_ANALYTICS_DISABLED'
];
const print = `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(context)}.map((name) => [name, process.env[name] ?? null]))))`;
afterEach(() => vi.unstubAllEnvs());

test('a command a test starts does not believe it runs inside the verification around the test', async () => {
	// As a test finds its own environment when harness verify runs it.
	for (const name of context)
		vi.stubEnv(name, name === 'HARNESS_EVIDENCE_DIR' ? '/tmp/outer' : '1');
	const inherited = await runCommand(['node', '-e', print], process.cwd());
	expect(JSON.parse(inherited.stdout)).toEqual(
		Object.fromEntries(context.map((name) => [name, null]))
	);
	// The test still decides: what it passes itself reaches the command.
	const chosen = await runCommand(['node', '-e', print], process.cwd(), true, {
		TAKE_SCREENSHOT: '1',
		HARNESS_EVIDENCE_DIR: '/tmp/inner'
	});
	expect(JSON.parse(chosen.stdout)).toMatchObject({
		TAKE_SCREENSHOT: '1',
		HARNESS_EVIDENCE_DIR: '/tmp/inner',
		HARNESS_VERIFY: null,
		HARNESS_ANALYTICS_DISABLED: null
	});
	// The test's own process keeps the context, so a scenario test can still record evidence.
	expect(process.env.HARNESS_EVIDENCE_DIR).toBe('/tmp/outer');
});

// Browser fixture seeders also import these modules without a Vitest worker.
// Keep this reusable boundary check in the normal CLI integration gate.
test.each(['cli', 'unitProject', 'impactRepo', 'verifyRepo'])(
	'shared fixture support %s imports in a standalone Bun process',
	async (name) => {
		const result = await runCommand(
			[
				'bun',
				'-e',
				`await import("./test/support/${name}.ts"); console.log("fixture support ready");`
			],
			process.cwd(),
			false
		);
		expect(
			result.exitCode,
			'Shared fixture support must remain independent of test-runner initialization: ' +
				result.stderr
		).toBe(0);
		expect(result.stdout).toContain('fixture support ready');
	},
	30_000
);
