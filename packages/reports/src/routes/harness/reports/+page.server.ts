import { redirect } from '@sveltejs/kit';
/** The console has no report hub; its address opens the explorer. */
export function load() {
	redirect(308, '/harness');
}
