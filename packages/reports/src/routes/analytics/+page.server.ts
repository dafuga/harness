import { redirect } from '@sveltejs/kit';
/** Analytics moved into the console; old links keep working. */
export function load({ url }: { url: URL }) {
	redirect(308, '/harness/analytics' + url.search);
}
