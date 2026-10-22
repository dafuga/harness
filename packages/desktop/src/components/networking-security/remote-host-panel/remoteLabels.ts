import { plural } from '../../../utils/networking-security/remoteLabels';
import type { RemoteHostStatus } from '../../../models/development-tooling/Environment.types';

/** A relay as a person recognises it: its host, never a path or a query. */
export function relayName(origin: string | null): string {
	try {
		return new URL(origin ?? '').host;
	} catch {
		return '';
	}
}

const progress: Partial<Record<RemoteHostStatus['state'], string>> = {
	registering: ' · registering…',
	connecting: ' · connecting…',
	offline: ' · relay unreachable'
};

/** The desktop's own state in one line; the relay is named so a person sees where phones go. */
export function hostLine(status: RemoteHostStatus): string {
	return `Phone access is on · ${relayName(status.origin)}${progress[status.state] ?? ''}`;
}

export function hostSummary(status: RemoteHostStatus): string {
	if (!status.enabled) return 'Phone access off';
	const count = status.devices.length;
	return `Phone access on · ${count ? plural(count, 'phone') : 'no phone'}`;
}
