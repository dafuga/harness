// @harness-uid u_sbz3zzk4fx
import { ExpectedCliError } from '../../src/core/errors';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { getPriority, homedir, hostname, userInfo } from 'node:os';
import { join, relative } from 'node:path';

export function allowsE2e(): boolean {
	if (process.platform !== 'darwin' || process.env.GITHUB_ACTIONS === 'true') return true;
	try {
		const tracker = JSON.parse(
			readFileSync(join(homedir(), '.config', 'harness', 'tracker.json'), 'utf8')
		);
		return tracker.node === 'harbor-mbp-2';
	} catch {
		return /^harbor-mbp-2(?:\.|$)/i.test(hostname());
	}
}

export function backgroundArguments(args: string[]): string[] {
	const priority = process.platform === 'darwin' ? ['/usr/sbin/taskpolicy', '-b'] : [];
	return ['-n', String(Math.max(0, 10 - getPriority())), ...priority, ...args];
}

export async function withLegacyCheckSlot<T>(
	full: boolean,
	signal: AbortSignal,
	run: () => Promise<T>
): Promise<T> {
	if (!full || process.platform !== 'darwin') return await run();
	// Match x9b4rr's full-check lock while older check entry points are still installed.
	const path = join(userInfo().homedir, '.harness-full-check.lock');
	const lock = await open(
		path,
		constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
		0o600
	);
	try {
		const waiter = spawn('/usr/bin/lockf', ['3'], {
			stdio: ['ignore', 'ignore', 'ignore', lock.fd],
			signal
		});
		const [code] = await once(waiter, 'exit');
		if (code !== 0) throw new ExpectedCliError('Could not acquire the macOS full-check slot.');
		signal.throwIfAborted();
		return await run();
	} finally {
		await lock.close();
	}
}

export function checkEnvironment(env: Record<string, string | undefined>) {
	const allowed =
		/^(?:PATH|HOME|TMPDIR|TMP|TEMP|USER|SHELL|TERM|LANG|TZ|CI|DISPLAY|XAUTHORITY|DEVELOPER_DIR|RUSTUP_TOOLCHAIN|CARGO_HOME|RUSTUP_HOME|BUN_INSTALL_CACHE_DIR|PLAYWRIGHT_BROWSERS_PATH|LC_\w+|HARNESS_RESOURCE_\w+|HARNESS_RESOURCES_HOME|HARNESS_DEBT_RATCHET_BASE)$/;
	return Object.fromEntries(Object.entries(env).filter(([name]) => allowed.test(name)));
}

export function checkTypeConfig(root: string, cwd: string, files: string[]): string {
	const config = join(cwd, `.harness-check-types-${randomUUID()}.json`);
	const extendsConfig = existsSync(join(cwd, 'tsconfig.json'))
		? './tsconfig.json'
		: relative(cwd, join(root, 'tsconfig.json'));
	writeFileSync(
		config,
		JSON.stringify({
			extends: extendsConfig,
			files,
			include: [],
			exclude: []
		}),
		{ flag: 'wx' }
	);
	return config;
}
