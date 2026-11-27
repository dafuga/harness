// @harness-uid u_bav2a24jzh
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ColimaRuntimeOptions } from './colimaRuntime.types';

const run = promisify(execFile);
export const colimaProfile = 'harness-browser';

/**
 * A VM of its own caps every browser at 2 CPUs and 4 GB. It mounts nothing from this Mac and does
 * not change the active Docker context or the SSH config.
 */
export function colimaStartArgs(diskImage?: string): string[] {
	return [
		'start',
		colimaProfile,
		'--cpus=2',
		'--memory=4',
		'--disk=20',
		'--vm-type=vz',
		'--mount=none',
		'--activate=false',
		'--ssh-config=false',
		...(diskImage ? [`--disk-image=${diskImage}`] : [])
	];
}

export async function ensureColima(options: ColimaRuntimeOptions = {}): Promise<void> {
	const execute =
		options.execute ??
		((args: string[]) => run('colima', args, { timeout: 600_000 }).then(() => undefined));
	const running = await execute(['status', colimaProfile]).then(
		() => true,
		() => false
	);
	if (running) return;
	await execute(colimaStartArgs(options.diskImage)).catch(() => {
		throw new ExpectedCliError(
			`Could not start the ${colimaProfile} VM. Run: colima start ${colimaProfile}`
		);
	});
}
