import type { PreviewCases } from './shared';
import { stamp, done } from './shared';
const projects = [{ id: 'preview-project', name: 'Preview project' }];
const request = {
	pairingId: 'preview-request',
	deviceId: 'preview-phone-key',
	deviceName: 'Ada’s iPhone',
	platform: 'iOS',
	requestedAt: stamp,
	expiresAt: '2026-10-20T10:05:05Z'
};
const devices = [
	{
		deviceId: 'preview-device',
		name: 'Ada’s iPhone',
		platform: 'iOS',
		projectIds: ['preview-project'],
		comments: true,
		agents: false,
		approvedAt: stamp,
		lastSeenAt: stamp,
		online: true
	}
];
const offer = {
	pairingId: 'preview-offer',
	hostId: 'preview-computer',
	origin: 'https://preview.invalid',
	code: 'SYNTHETIC',
	scan: 'harness://pairing/preview-only',
	expiresAt: '2026-10-20T10:05:05Z'
};
export function remotePreview() {
	const host = $state({
		busy: false,
		error: '',
		status: {
			supported: true,
			enabled: true,
			state: 'online',
			reason: null,
			host: { id: 'preview-computer', name: 'Ada’s Mac' },
			origin: 'https://preview.invalid',
			pairing: offer,
			requests: [],
			devices,
			projects
		},
		createPairing: done,
		closePairing: done,
		enable: done,
		disable: done,
		approve: done,
		deny: done,
		revoke: done
	});
	const phone = $state({
		busy: false,
		error: '',
		fixture: false,
		status: {
			state: 'online',
			origin: 'https://preview.invalid',
			host: { id: 'preview-computer', name: 'Ada’s Mac' },
			device: { id: 'preview-device', name: 'Ada’s iPhone' },
			grant: { projects: ['preview-project'], agents: false, comments: true },
			reason: null,
			lastOnlineAt: stamp
		},
		scan: done,
		disconnect: done
	});
	const cases: PreviewCases = {
		'desktop.component.remote-approval': { request, projects, store: host },
		'desktop.component.remote-devices': { devices, projects, store: host },
		'desktop.component.remote-host-panel': { store: host },
		'desktop.component.remote-offer-code': { offer, store: host },
		'desktop.component.remote-phone-panel': { store: phone }
	};
	return { host, phone, cases };
}
