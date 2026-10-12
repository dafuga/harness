import { redirect } from '@sveltejs/kit';
/** The root of this server is the explorer; the old address keeps working. */
export function load() {
	redirect(308, '/harness');
}
