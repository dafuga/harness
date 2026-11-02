// @harness-uid u_ozkn3vdtkd
import { redirect } from '@sveltejs/kit';
/** The root of this server is the explorer; the old address keeps working. */
export function load(): never {
	redirect(308, '/harness');
}
