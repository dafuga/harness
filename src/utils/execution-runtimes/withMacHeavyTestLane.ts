// @harness-uid u_czp53bdy3p
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { availableParallelism, loadavg, userInfo } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ExpectedCliError } from '../../core/errors';
import {
	trackerMacHeavyTestLoad,
	trackerOverloadedLoadPerCore
} from '../projects-sessions/trackerMachineStatus';

import type { LaneEnvironment, LaneHost } from './withMacHeavyTestLane.types';

const laneVariable = 'HARNESS_RESOURCE_HEAVY_TEST_LANE';
const legacyLock = '.harness-full-check.lock';
const lockBusy = 75;

// The runner argv and shell scripts used by Harness package commands.
const heavyRunner =
	/\bplaywright\s+test\b|\btest:(?:e2e|native|package|all)\b|\bvitest\s+run\b[^;\n]*\.e2e\.test\./;

export function isHeavyTestCommand(args: readonly string[]): boolean {
	if (args[0] === 'bun' && args[1] === 'scripts/run-checks.ts') return true;
	if (args[0] === 'sh' && args[1] === '-c') return heavyRunner.test(args[2] ?? '');
	return heavyRunner.test(args.join(' '));
}

/** Apply the same lane budget across worktrees and resource homes for the OS account. */
export async function withMacHeavyTestLane<T>(
	{
		enabled,
		signal,
		waitTimeoutMs,
		env = process.env
	}: {
		enabled: boolean;
		signal: AbortSignal;
		waitTimeoutMs?: number;
		env?: LaneEnvironment;
	},
	run: (env: LaneEnvironment, beforeStart: () => Promise<void>) => Promise<T>,
	host?: LaneHost
): Promise<T> {
	if (
		!enabled ||
		process.platform !== 'darwin' ||
		(env[laneVariable] && env.HARNESS_RESOURCE_LEASE)
	)
		return await run(env, () => Promise.resolve());
	const local = host ?? {
		directory: userInfo().homedir,
		cores: availableParallelism(),
		load: loadavg
	};
	const wait =
		waitTimeoutMs === undefined
			? signal
			: AbortSignal.any([signal, AbortSignal.timeout(waitTimeoutMs)]);
	const lock = await acquireLane(local, wait);
	try {
		signal.throwIfAborted();
		return await run({ ...env, [laneVariable]: '1' }, () => waitForLoad(local, wait));
	} finally {
		await lock.close();
	}
}

async function acquireLane(host: LaneHost, signal: AbortSignal) {
	const paths = [join(host.directory, legacyLock)];
	// A 10-core Mac can run two lanes while smaller Macs keep one.
	if (host.cores >= 10) paths.push(join(host.directory, legacyLock + '.2'));
	let lastNotice: string | undefined;
	while (true) {
		signal.throwIfAborted();
		const pressure = loadHold(host);
		if (!pressure) {
			for (const path of paths) {
				const lock = await tryLane(path, signal);
				if (lock) return lock;
			}
		}
		const reason = pressure ?? 'all macOS heavy test lanes are occupied';
		if (reason !== lastNotice) console.error(`[harness resources] Waiting: ${reason}`);
		lastNotice = reason;
		await delay(1000, undefined, { signal });
	}
}

async function waitForLoad(host: LaneHost, signal: AbortSignal): Promise<void> {
	signal.throwIfAborted();
	const pressure = loadHold(host);
	if (pressure) console.error(`[harness resources] Waiting: ${pressure}`);
	while (loadHold(host)) await delay(1000, undefined, { signal });
}

function loadHold(host: LaneHost): string | undefined {
	const [one, five] = host.load();
	const sustainedLimit = trackerOverloadedLoadPerCore * host.cores;
	if (one >= trackerMacHeavyTestLoad)
		return `1-min load ${one.toFixed(2)} (need under ${trackerMacHeavyTestLoad})`;
	return five > sustainedLimit
		? `5-min load ${five.toFixed(2)} (need at most ${sustainedLimit})`
		: undefined;
}

async function tryLane(path: string, signal: AbortSignal) {
	const lock = await open(
		path,
		constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW,
		0o600
	);
	let acquired = false;
	try {
		// Descriptor mode preserves the lock in this process and keeps the legacy lock inode stable.
		const waiter = spawn('/usr/bin/lockf', ['-s', '-t', '0', '3'], {
			stdio: ['ignore', 'ignore', 'inherit', lock.fd],
			signal
		});
		const [code] = await once(waiter, 'exit');
		if (code === lockBusy) return undefined;
		if (code !== 0)
			throw new ExpectedCliError(`Could not acquire a macOS heavy test lane (lockf ${code})`);
		acquired = true;
		return lock;
	} finally {
		if (!acquired) await lock.close();
	}
}
