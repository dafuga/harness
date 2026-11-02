// @harness-uid u_wiarymsjpv
import { redirect } from '@sveltejs/kit';
/** An earlier report link is answered where the console answers it: in the explorer. */
export function load({ params }: { params: { id: string } }): never {
	redirect(308, '/harness/reports/' + encodeURIComponent(params.id));
}
