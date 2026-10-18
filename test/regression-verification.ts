/** Run the existing loop, transport and shared-renderer checks in sequence, including on red. */
const jobs = [
	['x', 'vitest', 'run', 'test/regression-loops.test.ts', 'test/loop.e2e.test.ts'],
	[
		'run',
		'--cwd',
		'packages/desktop',
		'test:unit',
		'test/utils/recorded-projection.test.ts',
		'test/runtime-evidence-capture.test.ts'
	],
	[
		'run',
		'--cwd',
		'packages/desktop',
		'test:e2e',
		'tests/e2e/ui-evidence-review.spec.ts',
		'--grep',
		'regression history'
	]
];
let failed = false;
for (const args of jobs) {
	console.log(`Checking ${args.join(' ')}`);
	const result = Bun.spawnSync(['bun', ...args], {
		env: { ...process.env, HARNESS_DESKTOP_TEST_PORT: '5869' },
		stdout: 'inherit',
		stderr: 'inherit'
	});
	if (result.exitCode !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
