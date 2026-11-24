// @harness-uid u_32tlacz6al
import { json } from '@sveltejs/kit';

export function GET(): Response {
	return json({ ok: true, resource: 'deploy-approvals' });
}
