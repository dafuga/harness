import { json } from "@sveltejs/kit";
import { siteActivity } from "./siteActivity";

/** The activity of this site's repository, to whoever the owner policy admitted. It only reads. */
export async function GET(): Promise<Response> {
	const shown = await siteActivity();
	return json(shown ?? { status: 'unavailable' }, {
		headers: { 'cache-control': 'no-store' },
		status: shown ? 200 : 503
	});
}
