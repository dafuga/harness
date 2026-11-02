// @harness-uid u_ogfgoigb2u
import { redirect } from '@sveltejs/kit';
/** Analytics is not a page of the console any more; old links open the explorer. */
export function load(): never {
	redirect(308, '/harness');
}
