// @harness-uid u_tdevrsly3c
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const viewerSessionMs = 15 * 60_000;

/** Verifies the Access application token and returns the time its screen must disconnect. */
export function createViewerAccess(
	team: string,
	audience: string,
	email: string
): (assertion: string) => Promise<number | undefined> {
	const issuer = `https://${team}.cloudflareaccess.com`;
	const keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer), {
		timeoutDuration: 3000
	});
	return async (assertion) => {
		try {
			const { payload } = await jwtVerify(assertion, keys, {
				issuer,
				audience,
				algorithms: ['RS256'],
				requiredClaims: ['sub', 'iat', 'exp'],
				maxTokenAge: viewerSessionMs / 1000
			});
			if (payload.type !== 'app' || payload.email !== email) return undefined;
			return Math.min(payload.exp! * 1000, payload.iat! * 1000 + viewerSessionMs);
		} catch {
			return undefined;
		}
	};
}
