// @harness-uid u_tdqgsngwsz
import { json } from '@sveltejs/kit';

export function GET(): Response {
	return json({ ok: true, resource: 'video-flag-frame' });
}
