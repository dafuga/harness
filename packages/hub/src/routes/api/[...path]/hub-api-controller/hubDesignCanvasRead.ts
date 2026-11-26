// @harness-uid u_rqhuquyehq
import type { Context } from './HubApiController.types';
import { hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import { isCanvasName } from '$reports/utils/planning-collaboration/canvasManifest';

/** `GET …/designs?branch&commit&canvas`: a revision's canvases and one canvas's artboards. */
export async function hubDesignCanvasRead(context: Context): Promise<Response> {
	if (context.request.method !== 'GET') return hubHttp({ error: 'method-denied' }, 405);
	const query = new URL(context.request.url).searchParams;
	const commit = query.get('commit'),
		canvas = query.get('canvas');
	if ((commit && !/^[a-f0-9]{40}$/.test(commit)) || (canvas && !isCanvasName(canvas)))
		return hubFail('invalid-input');
	return hubHttp(
		await context.projection.designs(context.actor, context.projectId, {
			branch: query.get('branch'),
			commit,
			canvas
		})
	);
}
