import type {
	TaskUsage,
	TaskApiCost
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TaskPriceRates } from '../ModuleTaskAnalyticsService.types';
const anthropic = 'https://platform.claude.com/docs/en/about-claude/pricing';
const openai = 'https://developers.openai.com/api/docs/pricing';
const rates: Record<string, TaskPriceRates> = {
	'claude-haiku-5-5': {
		source: anthropic,
		threshold: 100000,
		short: [0.1, 0.01, 0.125, 0.2, 0.5],
		long: [0.5, 0.05, 0.625, 1, 2.5]
	},
	'claude-opus-5-5': {
		source: anthropic,
		threshold: Infinity,
		short: [4, 0.2, 5, 8, 20],
		long: [4, 0.2, 5, 8, 20]
	},
	'claude-sonnet-5-5': {
		source: anthropic,
		threshold: Infinity,
		short: [2, 0.1, 2.5, 4, 10],
		long: [2, 0.1, 2.5, 4, 10]
	},
	'gpt-6-luna': {
		source: openai,
		threshold: 272000,
		short: [0.1, 0.01, 0.125, 0.25, 0.5],
		long: [0.2, 0.02, 0.25, 0.5, 0.75]
	}
};
/** Token-equivalent standard/global API prices, never a subscription invoice. */
export function taskApiCost(model: string, usage?: TaskUsage): TaskApiCost {
	const rate = rates[model];
	const base = { rateCard: 'standard-global-2026-10-24', source: rate?.source ?? null };
	const reported = reportedCost(usage);
	if (reported !== null)
		return {
			...base,
			usd: reported,
			minimumUsd: reported,
			maximumUsd: reported,
			basis: 'cli-reported',
			note: 'CLI-reported API-equivalent token cost; actual subscription charge is unknown.'
		};
	if (!rate) return unavailable(base, 'No verified rates for this exact model.');
	if (!usable(usage)) return unavailable(base, 'CLI token usage is incomplete.');
	const low = priced(usage, rate.short, false);
	const high = priced(usage, usage.inputTokens! > rate.threshold ? rate.long : rate.short, true);
	if (low === null || high === null) return unavailable(base, 'Inconsistent token counters.');
	return {
		...base,
		usd: Math.abs(low - high) < 1e-12 ? low : null,
		minimumUsd: low,
		maximumUsd: high,
		basis: 'standard-api-estimate',
		note: 'Standard global token rates, excluding tools, regional and fast-tier surcharges. Ranges preserve missing cache-write duration and per-request context tiers.'
	};
}
function reportedCost(usage?: TaskUsage): number | null {
	const cost = usage?.reportedCostUsd;
	return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null;
}
function usable(usage?: TaskUsage): usage is TaskUsage {
	return [usage?.inputTokens, usage?.outputTokens].every((n) => n != null);
}
function unavailable(base: Pick<TaskApiCost, 'rateCard' | 'source'>, note: string): TaskApiCost {
	return { ...base, usd: null, minimumUsd: null, maximumUsd: null, basis: 'unavailable', note };
}
function priced(usage: TaskUsage, price: TaskPriceRates['short'], upper: boolean): number | null {
	const input = usage.inputTokens!,
		output = usage.outputTokens!,
		read = usage.cacheReadTokens;
	if (read !== null && read > input) return null;
	if (read === null)
		return (input * (upper ? Math.max(...price.slice(0, 4)) : price[1]) + output * price[4]) / 1e6;
	return pricedWrites(usage, price, upper, read);
}
function pricedWrites(
	usage: TaskUsage,
	price: TaskPriceRates['short'],
	upper: boolean,
	read: number
) {
	const input = usage.inputTokens!,
		output = usage.outputTokens!,
		write = usage.cacheWriteTokens;
	if (write === null)
		return (
			((input - read) * (upper ? price[3] : price[0]) + read * price[1] + output * price[4]) / 1e6
		);
	const long = usage.cacheWriteLongTokens;
	if (read + write > input || (long != null && long > write)) return null;
	const longer = long ?? (upper ? write : 0);
	return (
		((input - read - write) * price[0] +
			read * price[1] +
			(write - longer) * price[2] +
			longer * price[3] +
			output * price[4]) /
		1e6
	);
}
