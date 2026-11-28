// @harness-uid u_n6dmwj3gpk
import { z } from 'zod';

const cleanOrigin = z.url({ protocol: /^https$/ }).refine((value) => {
	const url = new URL(value);
	return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
});
const accessValue = z
	.string()
	.min(1)
	.max(4096)
	.regex(/^[\x21-\x7e]+$/);
const gateway = z.strictObject({
	origin: cleanOrigin,
	key: z.string().min(32).max(4096),
	access: z.object({ id: accessValue, secret: accessValue }).optional()
});

export function outgoingGateway(input: unknown) {
	if (typeof input !== 'string') return null;
	try {
		return gateway.safeParse(JSON.parse(input)).data ?? null;
	} catch {
		return null;
	}
}

const path = '/sync/owner/outgoing-drafts';
const bytes = new TextEncoder();

export async function forwardOutgoingDraft(
	method: 'GET' | 'POST',
	body: string,
	binding: z.infer<typeof gateway>,
	{ now, fetcher }: { now: number; fetcher: typeof fetch }
): Promise<Response> {
	const digest = hex(await crypto.subtle.digest('SHA-256', bytes.encode(body)));
	const key = await crypto.subtle.importKey(
		'raw',
		bytes.encode(binding.key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signed = await crypto.subtle.sign(
		'HMAC',
		key,
		bytes.encode(`${method}\n${path}\n${now}\n${digest}`)
	);
	return fetcher(new URL(path, binding.origin), {
		method,
		...(method === 'POST' && { body }),
		headers: {
			authorization: `TrackerHMAC ts=${now},sig=${hex(signed)}`,
			'content-type': 'application/json',
			...(binding.access && {
				'CF-Access-Client-Id': binding.access.id,
				'CF-Access-Client-Secret': binding.access.secret
			})
		},
		redirect: 'error',
		signal: AbortSignal.timeout(18_000)
	});
}

function hex(value: ArrayBuffer) {
	return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
