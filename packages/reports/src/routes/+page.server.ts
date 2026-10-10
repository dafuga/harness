import { redirect } from '@sveltejs/kit';
/** The report hub moved into the console; the old address keeps working. */
export function load({ url }: { url: URL }) {
	redirect(308, '/harness/reports' + url.search);
}
