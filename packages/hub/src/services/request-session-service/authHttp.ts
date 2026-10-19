const OPAQUE_BEARER = /^Bearer ([A-Za-z0-9_-]{32,128})$/;

export function sameOrigin(request: Request, origin: string): boolean {
	return request.headers.get('origin') === origin;
}

export function bearerToken(request: Request): string | null {
	return OPAQUE_BEARER.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;
}
