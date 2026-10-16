import { HostPairingService } from '../../../remote/src/index';
import type { RelayHostFrame, RemoteKeyPair, RemoteSocket } from '../../../remote/src/index';
import type { RemoteHostState } from '../adapters/RemoteHostStoreAdapter';
import { RelayLinkService } from './RelayLinkService';
import type { RelayLinkOptions, RelayLinkState } from './RelayLinkService';
import { RemoteDeviceSessionsService } from './RemoteDeviceSessionsService';
import type { RemoteDeviceSessionsOptions } from './RemoteDeviceSessionsService';

export type RelayLinkTuning = Pick<RelayLinkOptions, 'retryMs' | 'pingMs' | 'idleMs' | 'ackMs'>;
export interface RemoteHostRuntimeOptions {
	/** The live state: an approval or a revocation made later is seen here at once. */
	state: RemoteHostState;
	keys: RemoteKeyPair;
	name: string;
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	shared: RemoteDeviceSessionsOptions['shared'];
	link?: RelayLinkTuning;
	locked?: () => boolean | undefined;
	changed: () => void;
	/** The relay is reachable again. */
	ready: () => void;
	/** The owner revoked a device through the hub. */
	revoked: (deviceId: string) => void;
	seen: (deviceId: string) => void;
}

/** What runs while remote access is on: the relay link, the pairing offer, the phones' sessions. */
export class RemoteHostRuntimeService {
	readonly pairing: HostPairingService;
	readonly sessions: RemoteDeviceSessionsService;
	readonly link: RelayLinkService;
	private readonly present = new Set<string>();
	constructor(private readonly options: RemoteHostRuntimeOptions) {
		const { state, keys, name, shared } = options,
			{ hostId } = state;
		this.pairing = new HostPairingService({ hostId, keys });
		this.sessions = new RemoteDeviceSessionsService({
			shared,
			host: () => ({ id: hostId, name, keys, locked: options.locked?.() }),
			device: (deviceId) => state.devices.find((device) => device.deviceId === deviceId) ?? null,
			send: (address, packet) => void this.link.send({ type: 'packet', ...address, packet }),
			drop: (address, code) => void this.link.send({ type: 'device-drop', ...address, code })
		});
		this.link = new RelayLinkService({
			...options.link,
			open: options.open,
			origin: state.origin ?? '',
			hostId,
			credential: state.credential,
			onFrame: (frame) => this.frame(frame),
			onState: (linked) => this.linked(linked)
		});
	}
	start(): void {
		this.link.start();
	}
	/** Offline, with every session kept: system suspension, or the moment before a restart. */
	stop(): void {
		this.link.stop();
	}
	/** Disabled or quit: the phones' sessions end and their runs are cancelled. */
	end(): void {
		this.link.stop();
		this.sessions.end();
		this.pairing.close();
	}
	/** Whether the relay holds an open socket of this device. */
	online(deviceId: string): boolean {
		return this.present.has(deviceId);
	}
	private linked(state: RelayLinkState): void {
		if (state !== 'online') {
			this.present.clear();
			this.sessions.detachAll();
		}
		this.options.changed();
	}
	private frame(frame: RelayHostFrame): void {
		switch (frame.type) {
			case 'ready':
				this.present.clear();
				for (const device of frame.devices) if (device.online) this.present.add(device.deviceId);
				this.options.ready();
				break;
			case 'device-open':
				this.present.add(frame.deviceId);
				break;
			case 'device-close':
				this.present.delete(frame.deviceId);
				this.sessions.close(frame);
				this.options.seen(frame.deviceId);
				break;
			case 'packet':
				return void this.sessions.packet(frame, frame.packet);
			case 'pairing-request':
				return void this.pairing.receive(frame).then(() => this.options.changed());
			case 'device-revoked':
				this.options.revoked(frame.deviceId);
				break;
			default:
				return;
		}
		this.options.changed();
	}
}
