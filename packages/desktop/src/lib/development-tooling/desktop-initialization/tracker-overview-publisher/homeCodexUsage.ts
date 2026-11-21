// @harness-uid u_aqy5hxcviw
import { createHash } from 'node:crypto';
import type {
	HomeLimit,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { homeText } from '$reports/lib/projects-sessions/hub-home/homeTrackerText';
import { codexRpc } from '../../../../utils/agents-providers/codex-rpc/codexRpc';
import type { CodexAccount, CodexUsage, CodexUsageWindow } from './homeCodexUsage.types';

function windowLimit(id: string, value: CodexUsageWindow | null): HomeLimit | null {
	if (!value || !Number.isFinite(value.usedPercent)) return null;
	const duration = value.windowDurationMins;
	const label = duration === 300 ? '5-hour session' : duration === 10080 ? 'Weekly' : id;
	const resetsAt =
		value.resetsAt && Number.isFinite(value.resetsAt)
			? new Date(value.resetsAt * 1000).toISOString()
			: null;
	return {
		id,
		label,
		left: Math.max(0, Math.min(100, Math.round(100 - value.usedPercent))),
		resetsAt
	};
}

/** Signed-in Codex subscription readings. Account and limit RPCs create no inference turns. */
export async function readCodexUsage(now: number): Promise<HomeSubscription | null> {
	const rpc = await codexRpc();
	try {
		const { account, userId } = await rpc.request<CodexAccount>(
			'account/read',
			{ refreshToken: false },
			6000
		);
		if (account?.type !== 'chatgpt' || (!userId && !account.email)) return null;
		const { rateLimits } = await rpc.request<CodexUsage>('account/rateLimits/read', {}, 6000);
		if (!rateLimits) return null;
		const id = createHash('sha256')
			.update(JSON.stringify([userId ?? account.email, account.workspaceName]))
			.digest('hex');
		const limits = [
			windowLimit('Primary window', rateLimits.primary),
			windowLimit('Secondary window', rateLimits.secondary)
		].filter((limit): limit is HomeLimit => limit !== null);
		const credits = rateLimits.credits;
		return {
			id: `codex-${id.slice(0, 24)}`,
			provider: 'codex',
			plan: homeText(account.planType, 200),
			account: homeText(account.email, 200),
			readAt: new Date(now).toISOString(),
			limits,
			credits: credits?.unlimited
				? 'Unlimited'
				: homeText(credits?.balance ?? (credits?.hasCredits === false ? '0' : null), 200),
			history: [],
			agents: []
		};
	} finally {
		rpc.dispose();
	}
}
