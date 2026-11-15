// @harness-uid u_udyzin5pcn
import { json } from '@sveltejs/kit';

export function GET(): Response {
	return json({ ok: true, resource: 'video-flags' });
}

export const POST = GET;
