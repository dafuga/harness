// @harness-uid u_j5gjvr4vod
import { redirect } from '@sveltejs/kit';
/** The console has no report hub; its address opens the explorer. */
export function load() {
	redirect(308, '/harness');
}
