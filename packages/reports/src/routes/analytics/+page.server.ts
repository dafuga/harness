import { redirect } from '@sveltejs/kit';
/** Analytics is not a page of the console any more; old links open the explorer. */
export function load() {
	redirect(308, '/harness');
}
