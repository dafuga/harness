import { spawnSync } from 'node:child_process';

/** Audit the current project and return its exit status; unavailable executables throw. */
export function runAudit(): number {
	const harnessCliPath = process.env.HARNESS_CLI_PATH;
	const args = harnessCliPath
		? ['bun', harnessCliPath, 'audit', '.', '--profile', 'lib']
		: ['harness', 'audit', '.', '--profile', 'lib'];
	const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit' });
	if (result.error) throw result.error;
	return result.status ?? 1;
}

if (import.meta.main) process.exit(runAudit());
