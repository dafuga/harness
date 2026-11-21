// @harness-uid u_g7kdpz7bel
export class TrackerLocalApiService {
	handle(_request: Request): Promise<Response> {
		return Promise.resolve(new Response(null, { status: 404 }));
	}
}
