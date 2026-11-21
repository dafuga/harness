// @harness-uid u_gvqtr5mdwv
import type { TrackerNativeNotificationOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerDestination } from '../TrackerNotificationService.types';
import { readPrivateText } from './trackerNodeConfig';
import type { TrackerNodeConfig } from './trackerNodeConfig.types';
import { allowedTrackerTransport } from './trackerUpstreamLink';
import { TrackerNodeTransportError } from './TrackerNodeTransportError';

export function trackerNodeNotifications(
	config: TrackerNodeConfig
): TrackerNativeNotificationOptions | undefined {
	const { notifications, role } = config;
	if (!notifications) return undefined;
	if (role === 'spoke' && notifications.webhook) {
		throw new TypeError('Tracker webhook requires a hub');
	}
	const targets = new Map(
		Object.entries(notifications.targets).map(
			([id, spec]) => [id, deliveryTarget(spec.url, spec.bearerFile)] as const
		)
	);
	const locate = (id: string) => {
		const target = targets.get(id);
		if (!target) throw new TypeError('Unknown Tracker notification binding');
		return target;
	};
	const destination = (id: string): TrackerDestination => {
		locate(id);
		return { kind: 'http', id };
	};
	return {
		legacyDestinations: {
			urls: new Map((notifications.itemCallbacks ?? []).map((id) => [locate(id).raw, id]))
		},
		chiefOfStaff: notifications.chiefOfStaff ? destination(notifications.chiefOfStaff) : undefined,
		webhook: notifications.webhook
			? { destination: destination(notifications.webhook) }
			: undefined,
		destinations: {
			available: ({ kind, id }) => kind === 'http' && targets.has(id),
			async send({ id, destination, body, headers }) {
				if (destination.kind !== 'http') throw new TypeError('Tracker destination is unavailable');
				const { url, bearer } = locate(destination.id);
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
		}
	};
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
