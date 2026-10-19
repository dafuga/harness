import { remoteLimits } from '../models/Remote.types';
import type { AttachInput, RemoteAttachment } from '../models/Remote.types';
import { relayCloseCodes, relayHeaders } from '../models/RemoteRelay.types';
import type { SecurePacket } from '../models/RemoteSecure.types';
import { relaySocketUrl } from '../utils/relayOrigin';
import { fromBase64Url } from '../utils/remoteBytes';
import { importRemoteKeys } from '../utils/remoteKeys';
import { SecurePacketValidator } from '../validators/SecurePacketValidator';
import type { DeviceCredentials } from "./device-pairing-service/DevicePairingService";
import { SecureChannelService } from "./secure-channel-service/SecureChannelService";
import { WireClientService } from './WireClientService';

/** The few things a transport must offer. Text frames only. */
export interface RemoteSocket {
	opened: Promise<void>;
	send(text: string): void;
	close(code?: number): void;
	onMessage(listener: (text: string) => void): void;
	onClose(listener: (code: number) => void): void;
}
export type DeviceStatus = 'online' | 'offline' | 'revoked';
export interface DeviceConnectionOptions {
	credentials: DeviceCredentials;
	client: AttachInput['client'];
	/** Opens the socket with these request headers. The credential is in a header, never the URL. */
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	handshakeMs?: number;
	wire?: WireClientService;
}
type Reply = (packet: SecurePacket | null) => void;

function within<T>(work: Promise<T>, milliseconds: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('The computer did not answer.')), milliseconds);
		const settle = () => clearTimeout(timer);
		work.then(resolve, reject).then(settle, settle);
	});
}

/** A phone's connection to its computer through the relay: reference and test client. */
export class DeviceConnectionService {
	readonly wire: WireClientService;
	private socket: RemoteSocket | null = null;
	private channel: SecureChannelService | null = null;
	private reply: Reply | null = null;
	private state: DeviceStatus | null = null;
	private readonly listeners = new Set<(state: DeviceStatus) => void>();
	private readonly packets = new SecurePacketValidator();
	constructor(private readonly options: DeviceConnectionOptions) {
		this.wire = options.wire ?? new WireClientService({ client: options.client });
	}
	onStatus(listener: (state: DeviceStatus) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	async connect(): Promise<RemoteAttachment> {
		const { origin, hostId, deviceId, credential } = this.options.credentials;
		const socket = this.options.open(relaySocketUrl(origin, hostId), {
			Authorization: `Bearer ${credential}`,
			[relayHeaders.role]: 'device',
			[relayHeaders.device]: deviceId
		});
		this.socket = socket;
		socket.onMessage((text) => void this.receive(socket, text));
		socket.onClose((code) => this.lost(socket, code));
		await socket.opened;
		return this.handshake(socket);
	}
	close(): void {
		const socket = this.socket;
		socket?.close(1000);
		if (socket) this.lost(socket, 1000);
	}
	/** A fresh channel on this socket: at connect, and again whenever the host returns. */
	private async handshake(socket: RemoteSocket): Promise<RemoteAttachment> {
		const { hostId, deviceId, keys, hostKey } = this.options.credentials,
			deadline = this.options.handshakeMs ?? remoteLimits.handshakeDeadlineMs;
		try {
			const staticKey = await importRemoteKeys(keys),
				peerKey = fromBase64Url(hostKey);
			const channel = new SecureChannelService({
				role: 'device',
				hostId,
				deviceId,
				staticKey,
				peerKey
			});
			const answered = new Promise<SecurePacket | null>((resolve) => (this.reply = resolve));
			socket.send(JSON.stringify(await channel.hello()));
			const packet = await within(answered, deadline);
			if (packet?.type !== 'accept') throw new Error('The computer refused this device.');
			await channel.accept(packet);
			this.channel = channel;
			const send = (text: string) =>
				void channel.seal(text, (sealed) => socket.send(JSON.stringify(sealed)));
			const attachment = await within(this.wire.bind(send), deadline);
			this.status('online');
			return attachment;
		} catch (error) {
			this.reply = null;
			this.down(this.state === 'revoked' ? 'revoked' : 'offline');
			throw error;
		}
	}
	private async receive(socket: RemoteSocket, text: string): Promise<void> {
		if (socket !== this.socket || text === 'pong') return;
		try {
			const value = text.length > remoteLimits.frameBytes ? null : (JSON.parse(text) as unknown);
			const notice = (value ?? {}) as { type?: string; event?: string };
			if (notice.type === 'relay') return this.noticed(socket, notice.event);
			const packet = this.packets.packet(value);
			if (packet.type !== 'sealed') return this.answered(packet);
			const opened = await this.channel?.open(packet);
			if (opened) this.wire.receive(opened);
		} catch {
			socket.close(relayCloseCodes.protocol);
			this.lost(socket, relayCloseCodes.protocol);
		}
	}
	private answered(packet: SecurePacket): void {
		const refused =
			packet.type === 'reject' && ['revoked', 'unknown-device'].includes(packet.reason);
		if (refused) this.state = 'revoked';
		const reply = this.reply;
		this.reply = null;
		if (reply) return reply(packet);
		if (packet.type === 'reject') this.down(refused ? 'revoked' : 'offline');
	}
	private noticed(socket: RemoteSocket, event: string | undefined): void {
		if (event === 'host-offline') return this.down('offline');
		if (event === 'host-online') void this.handshake(socket).catch(() => undefined);
	}
	private lost(socket: RemoteSocket, code: number): void {
		if (socket !== this.socket) return;
		this.socket = null;
		this.reply?.(null);
		this.reply = null;
		this.down(code === relayCloseCodes.unauthorized ? 'revoked' : 'offline');
	}
	private down(state: DeviceStatus): void {
		this.channel = null;
		this.wire.unbind();
		this.status(state);
	}
	private status(state: DeviceStatus): void {
		const changed = this.state !== state || !this.reported;
		this.state = state;
		this.reported = true;
		if (changed) for (const listener of [...this.listeners]) listener(state);
	}
	private reported = false;
}
