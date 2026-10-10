import { redirect } from '@sveltejs/kit';
/** Report pages moved into the console; old links keep working. */
export function load({ params, url }: { params: { id: string }; url: URL }) {
	redirect(308, '/harness/reports/' + encodeURIComponent(params.id) + url.search);
}
