import { ladderFrom, parseTrackerModelSpec } from './parseTrackerModelSpec';
import type { ClaudeMessageUsage, ClaudeTokenTotals } from './trackerClaudeTokenUsage.types';

/**
 * Total the usage of each API message once. Claude repeats a message id for every content block;
 * the last line has the final counts. Cost uses the Tracker rung's flat rates, and stays empty
 * when any model that used tokens has no rate.
 */
export function trackerClaudeTokenUsage(lines: readonly string[]): ClaudeTokenTotals | undefined {
	const messages = new Map<string, ClaudeMessageUsage>();
	for (const line of lines) {
		const message = parseMessage(line);
		if (message) messages.set(message.id, message);
	}
	if (!messages.size) return undefined;
	const total = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 };
	let cost: number | null = 0;
	for (const { model, usage } of messages.values()) {
		const counts = tokenCounts(usage);
		for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += counts[key];
		cost = addCost(cost, model, counts);
	}
	return { ...total, cost_usd: cost };
}

function parseMessage(line: string): ClaudeMessageUsage | undefined {
	if (!line) return undefined;
	const message = JSON.parse(line) as Partial<ClaudeMessageUsage>;
	return message.id && message.usage ? (message as ClaudeMessageUsage) : undefined;
}

function tokenCounts(usage: ClaudeMessageUsage['usage']) {
	const count = (value: unknown) =>
		typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
	return {
		input_tokens: count(usage.input_tokens),
		output_tokens: count(usage.output_tokens),
		cache_read_tokens: count(usage.cache_read_input_tokens),
		cache_write_tokens: count(usage.cache_creation_input_tokens)
	};
}

function addCost(
	cost: number | null,
	model: string | undefined,
	counts: ReturnType<typeof tokenCounts>
): number | null {
	if (cost === null || Object.values(counts).every((count) => count === 0)) return cost;
	const price = flatPrice(model);
	if (!price) return null;
	return (
		cost +
		(counts.input_tokens * price.input +
			counts.output_tokens * price.output +
			counts.cache_read_tokens * price.cacheRead +
			counts.cache_write_tokens * price.cacheWrite) /
			1e6
	);
}

/** Transcripts may name a dated release of a rung's model. */
function flatPrice(model = '') {
	try {
		return parseTrackerModelSpec(model.replace(/-\d{8}$/, ''), ladderFrom()).price;
	} catch {
		return null;
	}
}
