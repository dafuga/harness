// @harness-uid u_4h6kq2xv7d
import type {
	HomeLimit,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { codexRpc } from '../../../../utils/agents-providers/codex-rpc/codexRpc';

interface CodexWindow {
	usedPercent: number;
	windowDurationMins?: number | null;
	resetsAt?: number | null;
}

/** The part of `account/rateLimits/read` that Home shows. Fields the Codex CLI adds later are ignored. */
export interface CodexRateLimits {
	planType?: string | null;
	primary?: CodexWindow | null;
	secondary?: CodexWindow | null;
	credits?: { hasCredits: boolean; unlimited: boolean; balance?: string | null } | null;
}

export type QuotaSource = (now: number) => Promise<HomeSubscription | null>;

function windowLabel(minutes: number | null | undefined, fallback: string) {
	if (minutes === 300) return '5-hour window';
	if (minutes === 10080) return 'Weekly';
	if (!minutes || minutes <= 0) return fallback;
	return minutes % 1440 === 0
		? `${minutes / 1440}-day window`
		: `${Math.round(minutes / 60)}-hour window`;
}

function limitFor(
	id: string,
	entry: CodexWindow | null | undefined,
	fallback: string
): HomeLimit[] {
	if (!entry || !Number.isFinite(entry.usedPercent)) return [];
	const used = Math.min(100, Math.max(0, entry.usedPercent));
	const resets = entry.resetsAt ? new Date(entry.resetsAt * 1000) : null;
	return [
		{
			id,
			label: windowLabel(entry.windowDurationMins, fallback),
			left: Math.round(100 - used),
			resetsAt: resets && Number.isFinite(resets.getTime()) ? resets.toISOString() : null
		}
	];
}

function creditsText(credits: CodexRateLimits['credits']) {
	if (!credits) return null;
	if (credits.unlimited) return 'Unlimited';
	return credits.hasCredits && credits.balance ? credits.balance : null;
}

function planName(plan: string | null | undefined) {
	return plan && plan !== 'unknown' ? plan.charAt(0).toUpperCase() + plan.slice(1) : null;
}

/** Codex reports a short and a long window; nothing but percentages, plan and credit balance leaves the Mac. */
export function codexSubscription(limits: CodexRateLimits, now: number): HomeSubscription | null {
	const list = [
		...limitFor('primary', limits.primary, 'Usage window'),
		...limitFor('secondary', limits.secondary, 'Weekly')
	];
	if (!list.length) return null;
	return {
		id: 'codex',
		provider: 'codex',
		plan: planName(limits.planType),
		account: null,
		readAt: new Date(now).toISOString(),
		limits: list,
		credits: creditsText(limits.credits),
		history: [],
		agents: []
	};
}

/** Asks the signed-in Codex CLI for its own usage; a signed-out or missing CLI is simply unknown. */
export function createCodexQuotaSource(open: typeof codexRpc = codexRpc): QuotaSource {
	return async (now) => {
		const rpc = await open();
		try {
			const result = await rpc.request<{ rateLimits?: CodexRateLimits }>(
				'account/rateLimits/read',
				{},
				15000
			);
			return result.rateLimits ? codexSubscription(result.rateLimits, now) : null;
		} finally {
			rpc.dispose();
		}
	};
}
