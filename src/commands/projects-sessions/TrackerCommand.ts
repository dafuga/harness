// @harness-uid u_r7qgepnoax
import type { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { constants, homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export class TrackerCommand {
	register(program: Command): void {
		program
			.command('tracker [args...]')
			.description('Use the shared Tracker service.')
			.allowUnknownOption()
			.action((args: string[]) => {
				process.exitCode = this.run(args);
			});
	}

	run(args: string[]): number {
		if (process.env.HARNESS_TRACKER_FORWARD_PARENT === String(process.ppid)) {
			console.error('tracker: the shim needs a retained legacy client.');
			return 126;
		}
		const executable = legacyExecutable();
		if (!isAbsolute(executable)) {
			console.error('tracker: HARNESS_TRACKER_LEGACY_BIN must be an absolute path.');
			return 126;
		}
		const result = spawnSync(executable, args, {
			stdio: 'inherit',
			env: { ...process.env, HARNESS_TRACKER_FORWARD_PARENT: String(process.pid) }
		});
		if (result.error) {
			console.error(
				'tracker: could not start the legacy client. Check HARNESS_TRACKER_LEGACY_BIN.'
			);
			return 'code' in result.error && result.error.code === 'ENOENT' ? 127 : 126;
		}
		if (result.status !== null) return result.status;
		return result.signal ? 128 + constants.signals[result.signal] : 1;
	}
}

function legacyExecutable(): string {
	const configured = process.env.HARNESS_TRACKER_LEGACY_BIN;
	if (configured) return configured;
	const local = join(homedir(), '.local');
	const retained = join(local, 'libexec', 'harness', 'tracker-legacy');
	return existsSync(retained) ? retained : join(local, 'bin', 'tracker');
}
