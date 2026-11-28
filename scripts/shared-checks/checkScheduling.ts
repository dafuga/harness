// @harness-uid u_sbz3zzk4fx
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { getPriority, homedir, hostname } from 'node:os';
import { join, relative } from 'node:path';

import { isHeavyTestCommand } from '../../src/utils/execution-runtimes/withMacHeavyTestLane';
import type { CheckPlan } from './sharedCheck.types';

export function checkNeedsHeavyLane(plan: CheckPlan): boolean {
	return (
		plan.mode !== 'focused' ||
		[...(plan.setup ?? []), ...plan.checks].some(
			(check) => check.browser || isHeavyTestCommand(check.command)
		)
	);
}

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
