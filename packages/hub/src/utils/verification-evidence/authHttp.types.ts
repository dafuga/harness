export interface AuthHttpOptions {
	status?: number;
	cookies?: string[];
}

export type AuthRoute = (request: Request) => Promise<Response>;

/** Keyed by `METHOD /path`. */
export type AuthRoutes = Record<string, AuthRoute>;
