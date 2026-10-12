import { hubHttp } from './hubHttp';
const limits: Record<string, number> = {
	'/api/auth/challenge': 10,
	'/api/auth/google': 20,
	'/api/auth/email/start': 5,
	'/api/auth/email/verify': 10,
	'/api/auth/native/start': 10,
	'/api/auth/native/poll': 60,
	'/api/auth/native/approve': 10,
	'/api/auth/native/exchange': 10
};
/** Cloudflare supplies the IP; tests/local runs use an isolated default key. No IP is stored. */
export async function hubRateLimit(input: {
	request: Request;
	db?: D1Database;
	secret?: string;
	ip?: string;
	now?: number;
}): Promise<Response | null> {
	const path = new URL(input.request.url).pathname,
		limit = limits[path];
	if (input.request.method !== 'POST' || !limit || !input.db || !input.secret) return null;
	const now = input.now ?? Date.now(),
		bytes = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		bytes.encode(input.secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const digest = await crypto.subtle.sign(
		'HMAC',
		key,
		bytes.encode((input.ip ?? 'local') + ':' + path)
	);
	const identity = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
	const result = await input.db
		.prepare(
			`INSERT INTO hub_rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count`
		)
		.bind(identity, now + 60000, now, now, now + 60000)
		.first<{ count: number }>();
	if (!result || result.count > limit) {
		const response = hubHttp({ error: 'rate-limited' }, 429);
		response.headers.set('Retry-After', '60');
		return response;
	}
	return null;
}
