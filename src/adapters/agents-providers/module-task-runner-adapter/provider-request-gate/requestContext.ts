// @harness-uid u_rw64iex44n
import { createHash } from 'node:crypto';
import type { CountInputTokens, InputPart, RequestContext } from './requestContext.types';

/** Fingerprint request input in memory and reuse the estimate for unchanged content. */
export function requestContext(
	body: string,
	prior: RequestContext | undefined,
	count: CountInputTokens
): RequestContext | undefined {
	const payload = JSON.parse(body) as Record<string, unknown> | null;
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
	const { input, messages, tools, ...metadata } = payload;
	const content = input ?? messages;
	if (typeof content !== 'string' && !Array.isArray(content)) return undefined;
	const incremental = typeof payload.previous_response_id === 'string';
	const items = Array.isArray(content) ? content : [content];
	const fields = Object.entries(metadata).map(
		([key, value]) => [key, fingerprint([key, value], () => prior?.fields.get(key), count)] as const
	);
	return {
		fields: new Map(fields),
		tools: toolParts(tools, prior, count),
		items: items.map((value, index) => fingerprint(value, () => prior?.items[index], count)),
		incremental,
		tokens: !prior || incremental ? count(body) : 0
	};
}

export function pendingInputTokens(next: RequestContext, prior?: RequestContext): number {
	if (!prior || next.incremental) return next.tokens;
	let shared = 0;
	while (shared < next.items.length && next.items[shared].hash === prior.items[shared]?.hash)
		shared++;
	const changed = Array.from(next.fields).filter(
		([key, part]) => prior.fields.get(key)?.hash !== part.hash
	);
	// MCP tools connect mid-session and move others. Only a new or changed definition is new input.
	const admitted = new Set(prior.tools.map((part) => part.hash));
	const added = next.tools.filter((part) => !admitted.has(part.hash));
	const parts = [...next.items.slice(shared), ...added, ...changed.map(([, part]) => part)];
	return parts.reduce((tokens, part) => tokens + part.tokens + 1, 0);
}

function toolParts(
	tools: unknown = [],
	prior: RequestContext | undefined,
	count: CountInputTokens
): InputPart[] {
	const known = new Map(prior?.tools.map((part) => [part.hash, part]));
	const list = Array.isArray(tools) ? tools : [tools];
	return list.map((tool) => fingerprint(tool, (hash) => known.get(hash), count));
}

function fingerprint(
	value: unknown,
	previous: (hash: string) => InputPart | undefined,
	count: CountInputTokens
): InputPart {
	const text = JSON.stringify(value);
	const hash = createHash('sha256').update(text).digest('hex');
	const prior = previous(hash);
	return prior?.hash === hash ? prior : { hash, tokens: count(text) };
}

export async function inputTokenCounter(): Promise<CountInputTokens> {
	const { countTokens } = await import('gpt-tokenizer/encoding/o200k_base');
	const options = { disallowedSpecial: new Set<string>() };
	return (text) => countTokens(text, options);
}
