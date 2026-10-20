import { baseHeaders, withCookies } from '../../../../utils/authHttp';

export function authRedirect(location: string, cookies: string[] = []): Response {
	const headers = { ...baseHeaders, Location: location, 'Referrer-Policy': 'no-referrer' };
	return withCookies(new Response(null, { status: 303, headers }), cookies);
}
