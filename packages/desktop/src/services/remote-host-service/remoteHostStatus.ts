import { RemoteHostStatusInput } from '../../utils/remoteHostStatus';
import { pairingOffer } from '../../../../remote/src/index';
import type {
	RemoteDeviceInfo,
	RemoteHostStatus,
	RemotePairingOffer
} from '../../../../remote/src/index';
import type { RemoteHostDevice, RemoteHostState } from '../../adapters/RemoteHostStoreAdapter';
import type { RemoteHostRuntimeService } from '../RemoteHostRuntimeService';

const reasons: Partial<Record<RemoteHostStatus['state'], string>> = {
	unavailable: 'OS encryption is required for remote access.',
	'signed-out': 'Connect to Harness Hub on this computer first.',
	connecting: 'Connecting to the relay.',
	offline: 'The relay cannot be reached. Paired phones are offline.'
};

function stateOf(input: RemoteHostStatusInput, enabled: boolean): RemoteHostStatus['state'] {
	if (!input.supported) return 'unavailable';
	if (input.phase !== 'idle') return input.phase;
	if (!enabled) return 'disabled';
	return input.runtime ? input.runtime.link.state : 'offline';
}

function offerOf(
	state: RemoteHostState,
	runtime: RemoteHostRuntimeService
): RemotePairingOffer | null {
	const offer = runtime.pairing.offer(),
		{ hostId, origin } = state;
	if (!offer || !origin) return null;
	/** What cannot be written as the text of a QR code is not offered at all. */
	try {
		return { ...offer, hostId, origin, scan: pairingOffer({ ...offer, hostId, origin }) };
	} catch {
		return null;
	}
}

function deviceOf(
	device: RemoteHostDevice,
	runtime: RemoteHostRuntimeService | null
): RemoteDeviceInfo {
	const { deviceId, name, platform, agents, approvedAt, lastSeenAt } = device,
		projectIds = device.projects.map((project) => project.id),
		online = runtime ? runtime.online(deviceId) : false;
	return {
		deviceId,
		name,
		platform,
		projectIds,
		agents,
		approvedAt,
		lastSeenAt,
		online,
		...(device.comments === undefined ? {} : { comments: device.comments })
	};
}

/** Pairing, requests and devices, as far as they exist for the host that is on. */
function viewOf(active: RemoteHostState | null, runtime: RemoteHostRuntimeService | null) {
	return {
		pairing: active && runtime ? offerOf(active, runtime) : null,
		requests: runtime ? runtime.pairing.requests() : [],
		devices: active ? active.devices.map((device) => deviceOf(device, runtime)) : []
	};
}

/** What the renderer may know: public metadata. No key and no credential is ever part of it. */
export function remoteHostStatus(input: RemoteHostStatusInput): RemoteHostStatus {
	const { state, supported } = input,
		on = supported && state !== null && state.enabled,
		active = on ? state : null,
		status = stateOf(input, on);
	return {
		supported,
		enabled: on,
		state: status,
		reason: input.reason ?? reasons[status] ?? null,
		host: active ? { id: active.hostId, name: input.name } : null,
		origin: active ? active.origin : null,
		...viewOf(active, input.runtime),
		projects: input.projects.map(({ id, name }) => ({ id, name }))
	};
}
