// @harness-uid u_yatjr7fj3t
// Standard-global price card shared with Tracker item 6qrmt6.
import type {
	TaskApiCost,
	TaskUsage
} from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { PricedUsage, StandardRates } from './modelRunPricing.types';

export const RATE_CARD = 'standard-global-2026-11-19';
const claude = 'https://platform.claude.com/docs/en/about-claude/pricing';
const openai = 'https://developers.openai.com/api/docs/pricing';

// USD per million tokens: input, cached read, short write, long write, output.
const rates = new Map<string, StandardRates>(
	Object.entries({
		'claude-haiku-5-5': {
			source: claude,
			threshold: 100000,
			short: [0.1, 0.01, 0.125, 0.2, 0.5],
			long: [0.5, 0.05, 0.625, 1, 2.5]
		},
		'claude-sonnet-5-5': fixed(claude, [2, 0.1, 2.5, 4, 10]),
		'claude-opus-5-5': fixed(claude, [4, 0.2, 5, 8, 20]),
		'claude-fable-5-2': fixed(claude, [8, 0.2, 10, 16, 40]),
		'gpt-6-luna': standard([0.1, 0.01, 0.125, 0.25, 0.5]),
		'gpt-6.1-terra': standard([1, 0.05, 1.25, 2.5, 5]),
		'gpt-6.1-sol': standard([2, 0.1, 2.5, 5, 10]),
		'gpt-6.2-sol': standard([2, 0.1, 2.5, 5, 10]),
		'gpt-6-astra': standard([10, 1, 12.5, 25, 50]),
		'gpt-6.2-astra': standard([8, 0.4, 10, 20, 40])
	})
);

function fixed(source: string, price: number[]): StandardRates {
	return { source, threshold: Infinity, short: price, long: price };
}

function standard(price: number[]): StandardRates {
	return {
		source: openai,
		threshold: 272000,
		short: price,
		long: price.map((rate, i) => rate * (i === 4 ? 1.5 : 2))
	};
}

/**
 * The model run's total input includes cache reads and writes. Aggregated usage
 * may span different prompt lengths, so compute bounds where tiers are unknown.
 */
export function estimateApiCost(model: string, usage?: TaskUsage): TaskApiCost {
	const rate = rates.get(model);
	const base = { rateCard: RATE_CARD, source: rate?.source ?? null };
	const reported = usage?.reportedCostUsd;
	if (validReportedCost(reported)) {
		return {
			...base,
			usd: reported,
			minimumUsd: reported,
			maximumUsd: reported,
			basis: 'cli-reported',
			note: 'CLI-reported API-equivalent cost.'
		};
	}
	const unavailable = {
		...base,
		usd: null,
		minimumUsd: null,
		maximumUsd: null,
		basis: 'unavailable' as const
	};
	if (!rate || !hasTokenTotals(usage)) {
		return {
			...unavailable,
			note: rate ? 'Incomplete token usage.' : 'No verified price for this model.'
		};
	}
	if (!validTokenCounts(usage)) return { ...unavailable, note: 'Inconsistent token usage.' };
	return { ...base, ...estimateFromRates(rate, usage) };
}

function hasTokenTotals(usage?: TaskUsage): usage is PricedUsage {
	return usage?.inputTokens != null && usage.outputTokens != null;
}

function validReportedCost(cost: number | null | undefined): cost is number {
	return cost != null && Number.isFinite(cost) && cost >= 0;
}

function estimateFromRates(rate: StandardRates, usage: PricedUsage) {
	const high = usage.inputTokens > rate.threshold ? rate.long : rate.short;
	const minimumUsd = tokenCost(usage, rate.short, false);
	const maximumUsd = tokenCost(usage, high, true);
	return {
		usd: Math.abs(maximumUsd - minimumUsd) < 1e-12 ? minimumUsd : null,
		minimumUsd,
		maximumUsd,
		basis: 'standard-api-estimate' as const,
		note: 'Standard global token rates. Ranges reflect unknown cache and request context tiers.'
	};
}

function validTokenCounts(usage: PricedUsage): boolean {
	const {
		inputTokens: input,
		outputTokens: output,
		cacheReadTokens: read,
		cacheWriteTokens: write,
		cacheWriteLongTokens: long
	} = usage;
	return (
		[input, output, read, write, long].every(validCounter) &&
		(read ?? 0) + (write ?? 0) <= input &&
		(long == null || (write != null && long <= write))
	);
}

function validCounter(count: number | null | undefined): boolean {
	return count == null || (Number.isSafeInteger(count) && count >= 0);
}

function tokenCost(
	usage: PricedUsage,
	[uncached, hit, short, long, out]: number[],
	upper: boolean
): number {
	const {
		inputTokens: input,
		outputTokens: output,
		cacheReadTokens: read,
		cacheWriteTokens: write
	} = usage;
	const writeRate = upper ? long : uncached;
	const reads = read ?? (upper ? 0 : input - (write ?? 0));
	const writes = write ?? (upper ? input - reads : 0);
	const longWrites = usage.cacheWriteLongTokens ?? (upper ? writes : 0);
	return (
		((input - reads - writes) * (write === null ? writeRate : uncached) +
			reads * hit +
			(writes - longWrites) * short +
			longWrites * long +
			output * out) /
		1e6
	);
}
