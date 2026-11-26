// @harness-uid u_gvqtr5mdwv
import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
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
		legacyDestinations: {
			urls: new Map(itemCallbacks.map((id) => [http(id).raw, id])),
			commands: commandBindings(notifications)
		},
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

/** Each legacy command name must map to a configured script target; item text never names a command outside this map. */
function commandBindings({
	targets,
	commandCallbacks = {}
}: NonNullable<TrackerNodeConfig['notifications']>) {
	return new Map(
		Object.entries(commandCallbacks).map(([name, id]) => {
			const spec = Object.hasOwn(targets, id) ? targets[id] : undefined;
			if (!spec) throw new TypeError('Unknown Tracker notification binding');
			if (!('script' in spec))
				throw new TypeError('Tracker command callback requires a script target');
			return [name, id] as const;
		})
	);
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
	if ('script' in spec) {
		accessSync(spec.script, constants.X_OK);
		return { kind: 'command' as const, send: scriptDelivery(spec.script) };
	}
	if ('session' in spec)
		return { kind: 'command' as const, send: trackerDigestSession(spec, node) };
	return { kind: 'http' as const, ...deliveryTarget(spec.url, spec.bearerFile) };
}

/** Run a fixed script with no arguments. Any exit other than zero leaves the receipt uncertain, so the delivery retries. */
function scriptDelivery(path: string) {
	return (request: TrackerDeliveryRequest) =>
		new Promise<TrackerDeliveryResult>((resolve, reject) => {
			const uncertain = () =>
				new TrackerNodeTransportError('Tracker notification receipt is uncertain');
			const child = spawn(path, [], {
				shell: false,
				stdio: ['pipe', 'ignore', 'ignore'],
				timeout: 20_000,
				env: {
					PATH: process.env.PATH ?? '',
					HOME: process.env.HOME ?? '',
					...request.environment,
					TRACKER_DELIVERY_ID: request.id
				}
			});
			child.stdin.on('error', () => undefined);
			child.once('error', () => reject(uncertain()));
			child.once('close', (code) =>
				code === 0 ? resolve({ status: 'sent' }) : reject(uncertain())
			);
			child.stdin.end(request.body);
		});
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
