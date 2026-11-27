// @harness-uid u_sbz3zzk4fx
import type { CheckPart } from './run-checks.types';

/** The release check order. The shared service runs these steps one at a time. */
export const checkSteps = [
	'check:verification-forwards',
	'check:debt-ratchets',
	'check:e2e-list',
	'check:doc-links',
	'check:feature-status',
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

/**
 * CI runs each part on its own runner (the matrix in harness-verify.yml). A part starts from a
 * clean checkout, so it repeats the builds it reads. Every step above must be in a part.
 */
export const checkParts: Record<string, CheckPart> = {
	'static-unit': { steps: checkSteps.slice(0, checkSteps.indexOf('test:unit') + 1) },
	'e2e-1': { steps: ['build:kernel', 'test:e2e'], vitestShard: '1/2' },
	'e2e-2': { steps: ['build:kernel', 'test:e2e'], vitestShard: '2/2' },
	package: { steps: ['build:kernel', 'build', 'test:package'] },
	desktop: { steps: ['build:kernel', 'build', 'check:desktop'] },
	apps: {
		steps: [
			'build:kernel',
			'build',
			'audit:root',
			'units:check',
			'check:reports-source',
			'check:planning',
			'check:collaboration',
			'check:hub',
			'check:remote',
			'check:relay',
			'check:game'
		]
	}
};

const aliases: Record<string, string[]> = {
	'audit:root': ['src/cli/index.ts', 'audit', '.'],
	'units:check': ['src/cli/index.ts', 'units', 'check'],
	'check:reports-source': ['run', '--cwd', 'packages/reports', 'check']
};

/** Choose the whole check or one CI part. Other arguments are forwarded to check:game. */
export function planCheck(args: readonly string[]) {
	const selected = args[0] === '--part';
	const name = selected ? (args[1] ?? '') : '';
	if (selected && !Object.hasOwn(checkParts, name))
		throw new Error(`Unknown check part "${name}". Parts: ${Object.keys(checkParts).join(', ')}.`);
	const part: CheckPart = selected ? checkParts[name] : { steps: checkSteps };
	const forwarded = args.slice(selected ? 2 : 0);
	return {
		steps: part.steps,
		command(step: string): string[] {
			const command = [...(aliases[step] ?? ['run', step])];
			if (step === 'check:game') command.push(...forwarded);
			if (step === 'test:e2e' && part.vitestShard) command.push(`--shard=${part.vitestShard}`);
			return command;
		}
	};
}

if (import.meta.main) {
	if (process.env.GITHUB_ACTIONS !== 'true' || process.argv[2] !== '--part') {
		console.error('Submit the combined release with bun run check --release.');
		process.exit(1);
	}
	const plan = planCheck(process.argv.slice(2));
	process.exitCode = await runSteps(plan.steps, async (name) => {
		return await Bun.spawn(['bun', ...plan.command(name)], {
			stdin: 'inherit',
			stdout: 'inherit',
			stderr: 'inherit'
		}).exited;
	});
}
