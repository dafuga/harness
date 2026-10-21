import { hubBodyBytes } from './hubBodyBytes';
import { hubFail } from '../../development-tooling/hubJson';

export function hubHttp(value: unknown, status = 200) {
	return Response.json(value, {
		status,
		headers: {
			'Cache-Control': 'no-store',
			'Referrer-Policy': 'no-referrer',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}

export async function hubBody(request: Request): Promise<Record<string, unknown>> {
	if (!request.headers.get('Content-Type')?.startsWith('application/json'))
		return hubFail('invalid-input');

	try {
		const value: unknown = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(await hubBodyBytes(request))
		);
		if (value && typeof value === 'object' && !Array.isArray(value))
			return value as Record<string, unknown>;
	} catch {
		return hubFail('invalid-input');
	}
	return hubFail('invalid-input');
}
