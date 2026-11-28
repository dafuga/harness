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
	const { input, messages, ...metadata } = payload;
	const content = input ?? messages;
	if (typeof content !== 'string' && !Array.isArray(content)) return undefined;
	const incremental = typeof payload.previous_response_id === 'string';
	const items = Array.isArray(content) ? content : [content];
	const fields = Object.entries(metadata).map(
		([key, value]) => [key, fingerprint([key, value], prior?.fields.get(key), count)] as const
	);
	return {
		fields: new Map(fields),
		items: items.map((value, index) => fingerprint(value, prior?.items[index], count)),
		incremental,
		tokens: !prior || incremental ? count(body) : 0
	};
}

export function pendingInputTokens(next: RequestContext, prior?: RequestContext): number {
	if (!prior || next.incremental) return next.tokens;
	// A rewritten message does not make later, unchanged messages new input.
	const changedItems = next.items.filter((part, index) => part.hash !== prior.items[index]?.hash);
	const changedFields = Array.from(next.fields).filter(
		([key, part]) => prior.fields.get(key)?.hash !== part.hash
	);
	const parts = [...changedItems, ...changedFields.map(([, part]) => part)];
	return parts.reduce((tokens, part) => tokens + part.tokens + 1, 0);
}

function fingerprint(
	value: unknown,
	prior: InputPart | undefined,
	count: CountInputTokens
): InputPart {
	const text = JSON.stringify(value);
	const hash = createHash('sha256').update(text).digest('hex');
	return prior?.hash === hash ? prior : { hash, tokens: count(text) };
}

export async function inputTokenCounter(): Promise<CountInputTokens> {
	const { countTokens } = await import('gpt-tokenizer/encoding/o200k_base');
	const options = { disallowedSpecial: new Set<string>() };
	return (text) => countTokens(text, options);
}
