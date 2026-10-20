import { SecureChannelService, fromBase64Url, relayCloseCodes } from '../../../../remote/src/index';
import type {
	RemoteGrant,
	RemoteKeyPair,
	SecurePacket,
	WireChannel,
	WireLink
} from '../../../../remote/src/index';
import type { RemoteHostDevice } from '../../adapters/RemoteHostStoreAdapter';
import { DeviceSessionService } from './device-session-service/DeviceSessionService';
import type { DeviceSessionOptions } from './device-session-service/DeviceSessionService';

export interface DeviceAddress {
	deviceId: string;
	connectionId: string;
}
export interface RemoteDeviceSessionsOptions {
	shared: Omit<DeviceSessionOptions, 'host' | 'device' | 'grant' | 'epoch'>;
	host: () => { id: string; name: string; keys: RemoteKeyPair; locked?: boolean };
	/** The approved device as stored now, or null once it is revoked. */
	device: (deviceId: string) => RemoteHostDevice | null;
	send: (address: DeviceAddress, packet: SecurePacket) => void;
	drop: (address: DeviceAddress, code: number) => void;
}
interface Entry {
	session: DeviceSessionService;
	generation: number;
	connectionId: string | null;
	channel: SecureChannelService | null;
	link: WireLink | null;
}

/**
 * The sessions of the approved phones and the one live connection of each. A connection is
 * trusted only after its packets open with the keys of the approved device key.
 */
export class RemoteDeviceSessionsService {
	private readonly entries = new Map<string, Entry>();
	constructor(private readonly options: RemoteDeviceSessionsOptions) {}
	connected(deviceId: string): boolean {
		return Boolean(this.entries.get(deviceId)?.link);
	}
	async packet(address: DeviceAddress, packet: SecurePacket): Promise<void> {
		if (packet.type === 'hello') return this.hello(address, packet);
		const entry = this.entries.get(address.deviceId),
			current = entry?.connectionId === address.connectionId ? entry : null;
		if (packet.type !== 'sealed' || !current?.channel)
			return this.options.drop(address, relayCloseCodes.protocol);
		const text = await current.channel.open(packet).catch(() => undefined);
		if (text === undefined) return this.violation(address);
		if (text !== null) await current.link?.receive(text);
	}
	close(address: DeviceAddress): void {
		const entry = this.entries.get(address.deviceId);
		if (entry?.connectionId === address.connectionId) this.detach(entry);
	}
	/** The session ends: its runs are cancelled and late answers are never sent. */
	revoke(deviceId: string): void {
		const entry = this.entries.get(deviceId);
		if (!entry) return;
		this.entries.delete(deviceId);
		this.detach(entry);
		entry.session.end();
	}
	/** The host's socket is gone: every connection is void; the sessions wait for the next. */
	detachAll(): void {
		for (const entry of this.entries.values()) this.detach(entry);
	}
	/** An event for every phone that is connected now. It is not kept for the others. */
	announce(channel: WireChannel, value: unknown): void {
		for (const entry of this.entries.values())
			if (entry.link) entry.session.wire.emit(channel, value);
	}
	end(): void {
		for (const deviceId of [...this.entries.keys()]) this.revoke(deviceId);
	}
	private async hello(address: DeviceAddress, packet: SecurePacket): Promise<void> {
		const record = this.options.device(address.deviceId);
		if (!record) {
			this.options.send(address, { type: 'reject', reason: 'unknown-device' });
			return this.options.drop(address, relayCloseCodes.unauthorized);
		}
		const entry = this.entry(record),
			host = this.options.host();
		this.detach(entry);
		const channel = new SecureChannelService({
			role: 'host',
			hostId: host.id,
			deviceId: record.deviceId,
			staticKey: host.keys,
			peerKey: fromBase64Url(record.deviceKey),
			generation: record.generation
		});
		const accept = await channel.answer(packet).catch(() => null);
		if (!accept) return this.options.drop(address, relayCloseCodes.protocol);
		const seal = (text: string) =>
			void channel.seal(text, (sealed) => this.forward(entry, address, sealed)).catch(() => null);
		entry.connectionId = address.connectionId;
		entry.channel = channel;
		entry.link = entry.session.wire.connect(seal, () => this.violation(address));
		this.options.send(address, accept);
	}
	/** Only the current connection of a device is written to. */
	private forward(entry: Entry, address: DeviceAddress, packet: SecurePacket): void {
		if (entry.connectionId === address.connectionId) this.options.send(address, packet);
	}
	/** A new approval generation is a new session: nothing of the old one carries over. */
	private entry(record: RemoteHostDevice): Entry {
		const known = this.entries.get(record.deviceId);
		if (known?.generation === record.generation) return known;
		if (known) this.revoke(record.deviceId);
		const { id, name } = this.options.host(),
			{ deviceId, generation } = record;
		const session = new DeviceSessionService({
			...this.options.shared,
			host: { id, name },
			device: { id: deviceId, name: record.name },
			grant: () => this.grant(deviceId),
			locked: () => this.options.host().locked
		});
		const entry = { session, generation, connectionId: null, channel: null, link: null };
		this.entries.set(deviceId, entry);
		return entry;
	}
	private grant(deviceId: string): RemoteGrant {
		const record = this.options.device(deviceId);
		return record
			? {
					projects: record.projects,
					agents: record.agents,
					...(record.comments === undefined ? {} : { comments: record.comments })
				}
			: { projects: [], agents: false };
	}
	private detach(entry: Entry): void {
		entry.link?.close();
		entry.link = null;
		entry.channel = null;
		entry.connectionId = null;
	}
	private violation(address: DeviceAddress): void {
		this.close(address);
		this.options.drop(address, relayCloseCodes.protocol);
	}
}
