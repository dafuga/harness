// @harness-uid u_c5k2m7qpra
import { execFile } from 'node:child_process';
import { userInfo } from 'node:os';
import type {
	HomeLimit,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { QuotaSource } from './codexQuotaSource.types';
import type {
	ClaudeCredential,
	ClaudeQuotaDeps,
	ClaudeUsage,
	UsageLimit
} from './claudeQuotaSource.types';

const usageUrl = 'https://api.anthropic.com/api/oauth/usage';

/** The older per-window keys, used when a reply carries no `limits` list. */
const windows = [
	['five_hour', 'session', '5-hour window'],
	['seven_day', 'weekly', 'Weekly'],
	['seven_day_opus', 'weekly-opus', 'Weekly Opus'],
	['seven_day_sonnet', 'weekly-sonnet', 'Weekly Sonnet']
] as const;

function leftOf(used: number | null | undefined, resetsAt: string | null | undefined) {
	if (typeof used !== 'number' || !Number.isFinite(used)) return null;
	const resets = resetsAt ? new Date(resetsAt) : null;
	return {
		left: Math.round(100 - Math.min(100, Math.max(0, used))),
		resetsAt: resets && Number.isFinite(resets.getTime()) ? resets.toISOString() : null
	};
}

function describeLimit(entry: UsageLimit): { id: string; label: string } | null {
	if (entry.kind === 'session') return { id: 'session', label: '5-hour window' };
	if (entry.kind === 'weekly_all') return { id: 'weekly', label: 'Weekly' };
	const model = entry.scope?.model?.display_name?.trim();
	if (entry.kind !== 'weekly_scoped' || !model) return null;
	return {
		id: `weekly-${model.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
		label: `Weekly ${model}`
	};
}

function fromList(list: UsageLimit[]): HomeLimit[] {
	const seen = new Set<string>();
	return list.flatMap((entry) => {
		const named = describeLimit(entry);
		const reading = leftOf(entry.percent, entry.resets_at);
		if (!named || !reading || seen.has(named.id)) return [];
		seen.add(named.id);
		return [{ ...named, ...reading }];
	});
}

function fromWindows(usage: ClaudeUsage): HomeLimit[] {
	return windows.flatMap(([key, id, label]) => {
		const entry = usage[key];
		const reading = leftOf(entry?.utilization, entry?.resets_at);
		return reading ? [{ id, label, ...reading }] : [];
	});
}

function planName(plan: string | null | undefined) {
	return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : null;
}

/** Only percentages, reset times and the plan name leave this function; the token never does. */
export function claudeSubscription(
	usage: ClaudeUsage,
	plan: string | null,
	now: number
): HomeSubscription | null {
	const listed = Array.isArray(usage.limits) ? fromList(usage.limits) : [];
	const limits = (listed.length ? listed : fromWindows(usage)).slice(0, 10);
	if (!limits.length) return null;
	return {
		id: 'claude',
		provider: 'claude',
		plan: planName(plan),
		account: null,
		readAt: new Date(now).toISOString(),
		limits,
		credits: null,
		history: [],
		agents: []
	};
}

/**
 * Reads Claude Code's own login (the item stored under this Mac user's name; an older item with
 * another account name can be stale) from the Keychain into memory; nothing is logged or kept.
 */
export function readKeychainCredential(): Promise<ClaudeCredential | null> {
	if (process.platform !== 'darwin') return Promise.resolve(null);
	return new Promise((resolve) => {
		execFile(
			'/usr/bin/security',
			['find-generic-password', '-s', 'Claude Code-credentials', '-a', userInfo().username, '-w'],
			{ timeout: 10000, maxBuffer: 1 << 20 },
			(error, stdout) => {
				if (error) return resolve(null);
				try {
					const login = JSON.parse(stdout).claudeAiOauth;
					const expired = typeof login?.expiresAt === 'number' && login.expiresAt < Date.now();
					resolve(
						typeof login?.accessToken === 'string' && login.accessToken && !expired
							? { token: login.accessToken, plan: login.subscriptionType ?? null }
							: null
					);
				} catch {
					resolve(null);
				}
			}
		);
	});
}

/**
 * Asks Anthropic how much of the signed-in subscription is used. The token goes only to the fixed
 * api.anthropic.com usage address. Claude Code refreshes its own login, so an expired or refused
 * token is just unknown until the next read.
 */
export function createClaudeQuotaSource(deps: ClaudeQuotaDeps = {}): QuotaSource {
	const credential = deps.credential ?? readKeychainCredential;
	const send = deps.fetcher ?? fetch;
	return async (now) => {
		const login = await credential();
		if (!login) return null;
		const response = await send(usageUrl, {
			headers: {
				Authorization: `Bearer ${login.token}`,
				'anthropic-beta': 'oauth-2025-04-20',
				Accept: 'application/json'
			},
			redirect: 'error',
			signal: AbortSignal.timeout(15000)
		});
		if (!response.ok) return null;
		return claudeSubscription((await response.json()) as ClaudeUsage, login.plan, now);
	};
}
