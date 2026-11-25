// @harness-uid u_hixn27hjr2
import { z } from 'zod';
import type {
	SubscriptionLimit,
	SubscriptionReading
} from '../../services/agents-providers/SubscriptionQuotaService.types';
import { readCodexRateLimits } from './quota-codex-adapter/readCodexRateLimits';
import type { QuotaCodexAdapterConfig } from './QuotaCodexAdapter.types';

const windowPayload = z.object({
	usedPercent: z.number().min(0).max(100),
	windowDurationMins: z.number(),
	resetsAt: z.unknown()
});

const rateLimitsPayload = z.object({
	primary: z.unknown(),
	secondary: z.unknown(),
	credits: z.unknown(),
	planType: z.unknown()
});

const plans: Readonly<Record<string, string>> = {
	free: 'Free',
	go: 'Go',
	plus: 'Plus',
	pro: 'Pro',
	team: 'Team',
	business: 'Business',
	enterprise: 'Enterprise',
	edu: 'Edu'
};

function limitWindow(value: unknown): SubscriptionLimit | null {
	const parsed = windowPayload.safeParse(value);
	if (!parsed.success) return null;
	const { usedPercent, windowDurationMins, resetsAt } = parsed.data;
	const window =
		windowDurationMins === 300
			? { id: '5h', label: '5-hour' }
			: windowDurationMins === 10080
				? { id: 'weekly', label: 'Weekly' }
				: null;
	if (!window) return null;
	const epoch = z.number().int().positive().max(253402300799).safeParse(resetsAt);
	return {
		...window,
		left: 100 - usedPercent,
		resetsAt: epoch.success ? new Date(epoch.data * 1000).toISOString() : null
	};
}

function balance(value: unknown): string | null {
	const parsed = z
		.object({ balance: z.unknown(), hasCredits: z.unknown(), unlimited: z.unknown() })
		.safeParse(value);
	if (!parsed.success) return null;
	if (parsed.data.unlimited === true) return 'Unlimited';
	const amount = parsed.data.balance;
	if (typeof amount === 'string' && /^\d{1,18}(?:\.\d{1,18})?$/.test(amount)) return amount;
	return parsed.data.hasCredits === false ? '0' : null;
}

/** Reads Codex subscription windows and purchased-credit balance from the native local app server. */
export class QuotaCodexAdapter {
	constructor(private readonly config: QuotaCodexAdapterConfig = {}) {}

	async read(now: number): Promise<SubscriptionReading | null> {
		const data = await (this.config.readRpc ?? readCodexRateLimits)();
		const parsed = z.object({ rateLimits: rateLimitsPayload }).safeParse(data);
		if (!parsed.success) return null;
		const { primary, secondary, credits, planType } = parsed.data.rateLimits;
		const limits = [limitWindow(primary), limitWindow(secondary)].filter((item) => item !== null);
		limits.sort((a, b) => a.id.localeCompare(b.id));
		const amount = balance(credits);
		if (!limits.length && amount === null) return null;
		return {
			id: 'codex',
			provider: 'codex',
			plan: typeof planType === 'string' && Object.hasOwn(plans, planType) ? plans[planType] : null,
			account: null,
			readAt: new Date(now).toISOString(),
			limits,
			credits: amount,
			history: [],
			agents: []
		};
	}
}

export type { QuotaCodexAdapterConfig } from './QuotaCodexAdapter.types';
