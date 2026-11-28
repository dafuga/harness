// @harness-uid u_lttwnjwv4v
import type {
	HomeLimit,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { staleReading, warningFor } from './hubHomePresentation';
import { runTime } from './hubHomeTime';
import type { StripQuota } from './hubStripQuota.types';

type QuotaSpec = {
	provider: StripQuota['provider'];
	name: StripQuota['name'];
	window: string;
	pick: (limits: HomeLimit[]) => HomeLimit | undefined;
};

const dayMs = 86400000;
const resetWeekday = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	timeZone: 'Europe/Lisbon'
});

const claudeLimit = (limits: HomeLimit[]) => limits.find((limit) => /^5-hour/i.test(limit.label));

const codexLimit = (limits: HomeLimit[]) =>
	limits.find((limit) => /^weekly$/i.test(limit.label)) ??
	limits.find((limit) => !limit.id.startsWith('weekly-'));

const specs: QuotaSpec[] = [
	{ provider: 'claude', name: 'Claude', window: '5 hour', pick: claudeLimit },
	{ provider: 'codex', name: 'Codex', window: 'weekly', pick: codexLimit }
];

/** Claude's 5-hour and Codex's weekly limit, Claude first; a provider without a fresh reading shows none. */
export function stripQuota(subscriptions: HomeSubscription[] | null, now: number): StripQuota[] {
	const readings = subscriptions ?? [];
	return specs.map((spec) => entryFor(spec, readings, now));
}

function entryFor(spec: QuotaSpec, subscriptions: HomeSubscription[], now: number): StripQuota {
	const { provider, name, window } = spec;
	const limit = freshLimit(spec, subscriptions, now);
	if (!limit || Number.isNaN(limit.left)) {
		return { provider, name, window, left: null, tone: 'active', resets: 'No recent reading' };
	}
	const left = Math.round(Math.min(100, Math.max(0, limit.left)));
	return {
		provider,
		name,
		window,
		left,
		tone: toneFor(left),
		resets: resetText(limit.resetsAt, now)
	};
}

function freshLimit(spec: QuotaSpec, subscriptions: HomeSubscription[], now: number) {
	const reading = subscriptions.find(
		(subscription) =>
			subscription.provider === spec.provider && !staleReading(subscription.readAt, now)
	);
	return reading ? spec.pick(reading.limits) : undefined;
}

function toneFor(left: number): StripQuota['tone'] {
	if (left <= 0) return 'blocked';
	return warningFor(left) ? 'warn' : 'active';
}

function resetText(resetsAt: string | null, now: number) {
	if (!resetsAt) return 'resets unknown';
	const at = Date.parse(resetsAt);
	if (Number.isNaN(at)) return 'resets unknown';
	if (at <= now) return 'reset due';
	if (at - now < dayMs) return `resets ${runTime(resetsAt)}`;
	return `resets ${resetWeekday.format(new Date(at))}`;
}
