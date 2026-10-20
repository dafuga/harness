/** The hosted workspace and browser approval flow cannot be embedded by another site. */
export class HubResponsesMiddleware {
	handle(response: Response): Response {
		response.headers.set('X-Frame-Options', 'DENY');
		response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
		response.headers.set('Referrer-Policy', 'no-referrer');
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('Cache-Control', 'private, no-store');
		return response;
	}
}
