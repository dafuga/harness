// @harness-uid u_gvqtr5mdwv
import type { TrackerNativeNotificationOptions } from '../TrackerNativeRuntimeService.types';
import type {
	TrackerDeliveryRequest,
	TrackerDeliveryResult,
	TrackerDestination
} from '../TrackerNotificationService.types';
import { readPrivateText } from './trackerNodeConfig';
import type { TrackerNodeConfig, TrackerNodeTarget } from './trackerNodeConfig.types';
import { trackerDigestSession } from './trackerDigestSession';
import { allowedTrackerTransport } from './trackerUpstreamLink';
import { TrackerNodeTransportError } from './TrackerNodeTransportError';

const defaultSuggestions = ['play guitar', 'play video games', 'practice a language', 'just relax'];

export function trackerNodeNotifications(
	config: TrackerNodeConfig
): TrackerNativeNotificationOptions | undefined {
	const { notifications, node, role } = config;
	if (!notifications) return undefined;
	if (role === 'spoke' && notifications.webhook) {
		throw new TypeError('Tracker webhook requires a hub');
	}
	if (!notifications.webhook && (notifications.routes || notifications.unrouted)) {
		throw new TypeError('Tracker bot routes require a webhook');
	}
	const targets = new Map(
		Object.entries(notifications.targets).map(([id, spec]) => [id, nodeTarget(spec, node)] as const)
	);
	const locate = (id: string) => {
		const target = targets.get(id);
		if (!target) throw new TypeError('Unknown Tracker notification binding');
		return target;
	};
	const http = (id: string) => {
		const target = locate(id);
		if (target.kind !== 'http') throw new TypeError('Tracker session targets are digest only');
		return target;
	};
	const destination = (id: string): TrackerDestination => ({ kind: locate(id).kind, id });
	const { chiefOfStaff, itemCallbacks = [] } = notifications;
	if (chiefOfStaff) http(chiefOfStaff);
	return {
		legacyDestinations: { urls: new Map(itemCallbacks.map((id) => [http(id).raw, id])) },
		chiefOfStaff: chiefOfStaff ? destination(chiefOfStaff) : undefined,
		webhook: digestWebhook(notifications, destination),
		destinations: {
			available: ({ kind, id }) => targets.get(id)?.kind === kind,
			async send(request) {
				const target = locate(request.destination.id);
				if (target.kind !== request.destination.kind)
					throw new TypeError('Tracker destination is unavailable');
				return target.kind === 'http' ? postDelivery(target, request) : target.send(request);
			}
		}
	};
}

function digestWebhook(
	{
		webhook,
		routes,
		unrouted,
		suggestions = defaultSuggestions
	}: NonNullable<TrackerNodeConfig['notifications']>,
	destination: (id: string) => TrackerDestination
) {
	if (!webhook) return undefined;
	return {
		destination: destination(webhook),
		suggestions,
		...(routes && {
			routes: Object.fromEntries(
				Object.entries(routes).map(([name, route]) => [
					name,
					{ destination: destination(route.target), aliases: route.aliases }
				])
			)
		}),
		...(unrouted && { unrouted })
	};
}

function nodeTarget(spec: TrackerNodeTarget, node: string) {
	if ('session' in spec)
		return { kind: 'command' as const, send: trackerDigestSession(spec, node) };
	return { kind: 'http' as const, ...deliveryTarget(spec.url, spec.bearerFile) };
}

async function postDelivery(
	{ url, bearer }: ReturnType<typeof deliveryTarget>,
	{ id, body, headers }: TrackerDeliveryRequest
): Promise<TrackerDeliveryResult> {
	const response = await fetch(url, {
		method: 'POST',
		body,
		headers: {
			...headers,
			...(bearer && { authorization: `Bearer ${bearer}` }),
			'idempotency-key': id
		},
		redirect: 'error',
		signal: AbortSignal.timeout(20_000)
	});
	await response.body?.cancel();
	if (!response.ok)
		throw new TrackerNodeTransportError('Tracker notification receipt is uncertain');
	return { status: 'sent' };
}

function deliveryTarget(raw: string, bearerFile?: string) {
	const url = new URL(raw);
	if (!allowedTrackerTransport(url) || url.username || url.password || url.hash || url.search) {
		throw new TypeError('Tracker delivery requires a clean HTTPS or loopback HTTP URL');
	}
	const bearer = bearerFile ? trackerBearerToken(url, bearerFile) : undefined;
	return { raw, url, bearer };
}

function trackerBearerToken(url: URL, path: string) {
	if (url.protocol !== 'https:') throw new TypeError('Tracker bearer requires HTTPS');
	const bearer = readPrivateText(path).trim();
	if (!/^[\x21-\x7e]+$/.test(bearer)) {
		throw new TypeError('Invalid Tracker notification credential');
	}
	return bearer;
}
