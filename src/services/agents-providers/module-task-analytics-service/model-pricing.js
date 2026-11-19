// @harness-uid u_sak3l4rbdc
// Standard global per-model rates shared with Harness.
export const RATE_CARD = 'standard-global-2026-11-19';
const claude = 'https://platform.claude.com/docs/en/about-claude/pricing';
const openai = 'https://developers.openai.com/api/docs/pricing';

// USD per million tokens: input, cached read, short write, long write, output.
/** @type {Partial<Record<string, {source: string, threshold: number, short: number[], long: number[]}>>} */
const rates = Object.assign(Object.create(null), {
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
});

/** @param {string} source @param {number[]} price */
function fixed(source, price) {
	return { source, threshold: Infinity, short: price, long: price };
}

/** @param {number[]} price */
function standard(price) {
	return {
		source: openai,
		threshold: 272000,
		short: price,
		long: price.map((rate, i) => rate * (i === 4 ? 1.5 : 2))
	};
}

/** @typedef {{inputTokens: number|null, outputTokens: number|null, cacheReadTokens: number|null, cacheWriteTokens: number|null, cacheWriteLongTokens?: number|null, reportedCostUsd?: number|null}} TokenUsage */
/** @typedef {{usd: number|null, minimumUsd: number|null, maximumUsd: number|null,
 * basis: 'cli-reported'|'standard-api-estimate'|'unavailable', rateCard: string, source: string|null, note: string}} ApiEquivalentCost */

/**
 * The model run's total input includes cache reads and writes. Aggregated usage
 * may span different prompt lengths, so compute bounds where tiers are unknown.
 * @param {string} model @param {TokenUsage} [usage]
 * @returns {ApiEquivalentCost}
 */
export function estimateApiCost(model, usage) {
	const rate = rates[model];
	const base = { rateCard: RATE_CARD, source: rate?.source ?? null };
	const reported = usage?.reportedCostUsd;
	if (reported != null && Number.isFinite(reported) && reported >= 0) {
		return {
			...base,
			usd: reported,
			minimumUsd: reported,
			maximumUsd: reported,
			basis: /** @type {const} */ ('cli-reported'),
			note: 'CLI-reported API-equivalent cost.'
		};
	}
	const unavailable = {
		...base,
		usd: null,
		minimumUsd: null,
		maximumUsd: null,
		basis: /** @type {const} */ ('unavailable')
	};
	if (!rate || usage?.inputTokens == null || usage.outputTokens == null) {
		return {
			...unavailable,
			note: rate ? 'Incomplete token usage.' : 'No verified price for this model.'
		};
	}
	if (!consistentUsage(usage, usage.inputTokens)) {
		return { ...unavailable, note: 'Inconsistent token usage.' };
	}
	const counts = { ...usage, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
	const high = counts.inputTokens > rate.threshold ? rate.long : rate.short;
	const minimumUsd = tokenCost(counts, rate.short, false);
	const maximumUsd = tokenCost(counts, high, true);
	return {
		...base,
		usd: Math.abs(maximumUsd - minimumUsd) < 1e-12 ? minimumUsd : null,
		minimumUsd,
		maximumUsd,
		basis: /** @type {const} */ ('standard-api-estimate'),
		note: 'Standard global token rates. Ranges reflect unknown cache and request context tiers.'
	};
}

/** @param {TokenUsage} usage @param {number} input */
function consistentUsage(usage, input) {
	const {
		outputTokens: output,
		cacheReadTokens: read,
		cacheWriteTokens: write,
		cacheWriteLongTokens: long
	} = usage;
	const validCounts = [input, output, read, write, long].every(
		(n) => n == null || (Number.isSafeInteger(n) && n >= 0)
	);
	return (
		validCounts &&
		(read ?? 0) + (write ?? 0) <= input &&
		(long == null || (write != null && long <= write))
	);
}

/** @param {TokenUsage & {inputTokens: number, outputTokens: number}} usage @param {number[]} price @param {boolean} upper */
function tokenCost(usage, price, upper) {
	const [uncached, hit, short, long, out] = price;
	const { inputTokens: input, outputTokens: output } = usage;
	const read = usage.cacheReadTokens;
	const write = usage.cacheWriteTokens;
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
