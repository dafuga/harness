// @harness-uid u_d2pmwm5tae
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExpectedCliError } from '../src/core/errors';

const fullCheckLabel = 'Full repository check';

function isFullCheck(command: string[]): boolean {
	return command[0] === 'bun' && command[1] === 'scripts/run-checks.ts';
}

/** Construct the existing resource CLI request without shell interpolation. */
export function resourceArguments(
	args: string[],
	env: Record<string, string | undefined>
): string[] {
	const [priority, separator, ...command] = args;
	if (
		!['coding', 'agent-test', 'environment'].includes(priority) ||
		separator !== '--' ||
		!command.length
	)
		throw new ExpectedCliError(
			'Usage: with-resources <coding|agent-test|environment> -- <command...>'
		);
	const fullCheck = isFullCheck(command);
	return [
		'resources',
		'run',
		...(fullCheck ? ['--label', fullCheckLabel] : []),
		'--priority',
		fullCheck && process.platform === 'darwin'
			? 'agent-test'
			: env.HARNESS_RESOURCE_PRIORITY || priority,
		'--cpus',
		env.HARNESS_RESOURCE_CPUS || '1',
		'--memory-mib',
		env.HARNESS_RESOURCE_MEMORY_MIB || '2048',
		'--',
		...command
	];
}

async function runResources(args: string[]): Promise<void> {
	const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
	process.argv = [process.execPath, entry, ...args];
	const { runCli } = await import('../src/cli/runCli');
	await runCli(entry);
}

async function waitForFullCheckLock(fd: number): Promise<void> {
	// In fd mode lockf locks our open file description and leaves the inode in place.
	const waiter = spawn('/usr/bin/lockf', ['3'], { stdio: ['ignore', 'ignore', 'inherit', fd] });
	const cancel = () => waiter.kill('SIGTERM');
	const notice = setTimeout(
		() => console.error('[harness resources] Waiting for the Mac full-check slot'),
		1000
	);
	process.once('SIGINT', cancel);
	process.once('SIGTERM', cancel);
	try {
		const [code] = await once(waiter, 'exit');
		if (code !== 0) throw new ExpectedCliError('Mac full-check lock wait ended before admission');
	} finally {
		clearTimeout(notice);
		process.removeListener('SIGINT', cancel);
		process.removeListener('SIGTERM', cancel);
	}
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const resourceArgs = resourceArguments(args, process.env);
	if (process.platform === 'darwin' && isFullCheck(args.slice(2))) {
		// Use the OS account home so different resource homes still share this lock.
		const path = join(userInfo().homedir, '.harness-full-check.lock');
		const lock = await open(
			path,
			constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
			0o600
		);
		try {
			await waitForFullCheckLock(lock.fd);
			await runResources(resourceArgs);
		} finally {
			await lock.close();
		}
	} else {
		await runResources(resourceArgs);
	}
}
