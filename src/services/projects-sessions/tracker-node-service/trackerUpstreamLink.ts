// @harness-uid u_gvqtr5mdwv
import { z } from 'zod';
import type { TrackerUpstream } from './trackerNodeConfig.types';
import type { TrackerSpokeLoopOptions } from '../TrackerSpokeLoopService.types';
import { readPrivateJson } from './trackerNodeConfig';
import { TrackerNodeTransportError } from './TrackerNodeTransportError';

const accessSchema = z.strictObject({
	clientId: z
		.string()
		.min(1)
		.regex(/^[\x21-\x7e]+$/),
	clientSecret: z
		.string()
		.min(1)
		.regex(/^[\x21-\x7e]+$/)
});

export function trackerUpstreamLink(
	input: TrackerUpstream,
	secret: string,
	link: 'hub' | 'peer',
	relayOps: boolean
): Omit<TrackerSpokeLoopOptions, 'store'> {
	const endpoint = trackerEndpoint(input.url);
	const access = trackerAccessHeaders(input.accessFile, endpoint);
	return {
		endpoint,
		link,
		secret,
		relayOps,
		async transport(request, signal) {
			const response = await fetch(endpoint.origin + request.pathAndQuery, {
				method: request.method,
				body: request.body,
				headers: { ...request.headers, ...access },
				redirect: 'error',
				signal: AbortSignal.any([signal, AbortSignal.timeout(request.timeoutMs)])
			});
			if (!response.ok) {
				await response.body?.cancel();
				throw new TrackerNodeTransportError('Tracker signed sync request failed');
			}
			return response.json();
		}
	};
}

function trackerEndpoint(raw: string): URL {
	const url = new URL(raw);
	if (
		!allowedTrackerTransport(url) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		url.pathname !== '/'
	)
		throw new TypeError('Tracker upstream requires a clean HTTPS or loopback HTTP origin');
	return url;
}

export function allowedTrackerTransport(url: URL): boolean {
	return url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1');
}

function trackerAccessHeaders(path: string | undefined, endpoint: URL): Record<string, string> {
	if (!path) return {};
	if (endpoint.protocol !== 'https:')
		throw new TypeError('Tracker Access credentials require HTTPS');
	const { clientId, clientSecret } = accessSchema.parse(readPrivateJson(path));
	return { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret };
}
