// @harness-uid u_sbz3zzk4fx
/** The existing broad check order; no step is omitted or run concurrently. */
export const checkSteps = [
	'check:verification-forwards',
	'check:debt-ratchets',
	'check:e2e-list',
	'check:doc-links',
	'format:check',
	'typecheck',
	'lint',
	'check:kernel',
	'build:kernel',
	'test:unit',
	'test:e2e',
	'build',
	'test:package',
	'audit:root',
	'units:check',
	'check:reports-source',
	'check:planning',
	'check:desktop',
	'check:collaboration',
	'check:hub',
	'check:remote',
	'check:relay',
	'check:game'
];

/** Print elapsed time for each step and stop immediately at the first failure. */
export async function runSteps(
	steps: readonly string[],
	run: (name: string) => Promise<number>,
	report: (line: string) => void = console.log
): Promise<number> {
	for (const [index, name] of steps.entries()) {
		report(`[check ${index + 1}/${steps.length}] ${name}`);
		const started = performance.now();
		let code: number;
		try {
			code = await run(name);
		} catch {
			code = 1;
		}
		report(
			`[check] ${name}: ${code === 0 ? 'passed' : `failed (${code})`} in ${(performance.now() - started).toFixed(1)} ms`
		);
		if (code !== 0) return code;
	}
	return 0;
}

if (import.meta.main) {
	const forwarded = process.argv.slice(2);
	process.exitCode = await runSteps(checkSteps, async (name) => {
		const aliases: Record<string, string[]> = {
			'audit:root': ['src/cli/index.ts', 'audit', '.'],
			'units:check': ['src/cli/index.ts', 'units', 'check'],
			'check:reports-source': ['run', '--cwd', 'packages/reports', 'check']
		};
		const command = aliases[name] ?? ['run', name];
		return await Bun.spawn(['bun', ...command, ...(name === 'check:game' ? forwarded : [])], {
			stdin: 'inherit',
			stdout: 'inherit',
			stderr: 'inherit'
		}).exited;
	});
}
