// @harness-uid u_b4uzqkb2i6
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import type { ProviderCooldowns } from './providerCooldown.types';

/** Without a reset time from the provider, a rejected quota pauses dispatch this long. */
export const defaultQuotaPauseMs = 15 * 60 * 1000;

/** Machine-local record of providers whose quota rejected a task, shared by every worker of this clone. */
export async function cooldownFile(root: string): Promise<string> {
	const common = await new GitAdapter(root).run(['rev-parse', '--git-common-dir']);
	return resolve(root, common, '..', '.cache/harness/task-provider-cooldowns.json');
}

export async function readCooldowns(
	root: string,
	now: number = Date.now()
): Promise<ProviderCooldowns> {
	let stored: ProviderCooldowns = {};
	try {
		stored = JSON.parse(await readFile(await cooldownFile(root), 'utf8')) as ProviderCooldowns;
	} catch {
		return {};
	}
	return Object.fromEntries(
		Object.entries(stored).filter(([, cooldown]) => Date.parse(cooldown.until) > now)
	);
}

export async function recordCooldown(
	root: string,
	provider: 'claude' | 'codex',
	resetsAt?: number,
	now: number = Date.now()
): Promise<void> {
	const until = resetsAt && resetsAt * 1000 > now ? resetsAt * 1000 : now + defaultQuotaPauseMs;
	const file = await cooldownFile(root);
	const next = { ...(await readCooldowns(root, now)) };
	next[provider] = {
		until: new Date(until).toISOString(),
		recordedAt: new Date(now).toISOString()
	};
	await mkdir(dirname(file), { recursive: true });
	const temporary = `${file}.${process.pid}.tmp`;
	await writeFile(temporary, JSON.stringify(next, null, 2) + '\n');
	await rename(temporary, file);
}
