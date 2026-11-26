// @harness-uid u_ezxw6fs2bt
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CanaryItem, CanaryTracker } from './canary.types';

const run = promisify(execFile);

/** The installed `tracker` CLI. Arguments are passed as a list, never through a shell. */
export function trackerCli(program: string): CanaryTracker {
	return async (args) => {
		const { stdout } = await run(program, [...args, '--json'], {
			timeout: 60_000,
			maxBuffer: 16 * 1024 * 1024
		});
		return JSON.parse(stdout) as CanaryItem;
	};
}
