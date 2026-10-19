import { remoteLimits } from '../../models/Remote.types.ts';
import { SecureFailure } from '../../models/RemoteSecure.types.ts';
import type {
	RemoteKeyPair,
	SecureDirection,
	SecureFailureReason,
	SecurePacket,
	SecureRole,
	SessionKeys
} from '../../models/RemoteSecure.types.ts';
import { bytesText, concatBytes, fromBase64Url, randomBytes } from '../../utils/remoteBytes';
import { remoteBytes, toBase64Url } from '../../utils/remoteBytes';
import { remoteKeys } from '../../utils/remoteKeys';
import { openPacket, sealPacket } from './sealPacket';
import { sessionKeys } from './sessionKeys';

export interface SecureChannelOptions {
	role: SecureRole;
	hostId: string;
	deviceId: string;
	staticKey: RemoteKeyPair;
	/** The pinned static key of the other side. */
	peerKey: Uint8Array;
	/** Host only: the approval generation of the device, bound into the keys. */
	generation?: number;
	limits?: { chunkBytes?: number; messageBytes?: number };
	/** Fixed values, for the frozen vectors only. */
	ephemeral?: RemoteKeyPair;
	nonce?: Uint8Array;
}

function directionOf(role: SecureRole, outgoing: boolean): SecureDirection {
	return (role === 'device') === outgoing ? 'd2h' : 'h2d';
}

/** One end of the encrypted channel of one connection: handshake, sealing, strict counters. */
export class SecureChannelService {
	private keys: SessionKeys | null = null;
	private ephemeral: RemoteKeyPair | null = null;
	private nonce: Uint8Array | null = null;
	private started = false;
	private sent = 0;
	private received = 0;
	private parts: Uint8Array[] = [];
	private size = 0;
	private sending: Promise<unknown> = Promise.resolve();
	private receiving: Promise<unknown> = Promise.resolve();
	constructor(private readonly options: SecureChannelOptions) {}
	get ready(): boolean {
		return this.keys !== null;
	}
	/** Device: the first packet of a connection. */
	async hello(): Promise<SecurePacket> {
		const own = await this.begin('device');
		return { type: 'hello', version: 1, deviceId: this.options.deviceId, ...own };
	}
	/** Host: derives the keys from a device's hello and returns the accept packet. */
	async answer(hello: SecurePacket): Promise<SecurePacket> {
		if (hello.type !== 'hello' || hello.deviceId !== this.options.deviceId)
			throw new SecureFailure('packet');
		const own = await this.begin('host'),
			generation = this.options.generation ?? 0;
		await this.derive(hello, fromBase64Url(hello.nonce), this.nonce!, generation);
		return { type: 'accept', version: 1, ...own, generation };
	}
	/** Device: derives the keys from the host's accept. */
	async accept(packet: SecurePacket): Promise<void> {
		if (this.options.role !== 'device' || !this.nonce || this.keys)
			throw new SecureFailure('state');
		if (packet.type !== 'accept') throw new SecureFailure('packet');
		await this.derive(packet, this.nonce, fromBase64Url(packet.nonce), packet.generation);
	}
	/** Seals one message as one or more packets, handed to `emit` in the order they must be sent. */
	seal(text: string, emit: (packet: SecurePacket) => void): Promise<void> {
		const next = this.sending.then(() => this.sealNow(text, emit));
		this.sending = next.catch(() => undefined);
		return next;
	}
	/** Opens the next packet: the message once its last chunk arrived, null before that. */
	open(packet: SecurePacket): Promise<string | null> {
		const next = this.receiving.then(() => this.openNow(packet));
		this.receiving = next.catch(() => undefined);
		return next;
	}
	private async begin(role: SecureRole) {
		if (this.options.role !== role || this.started) throw new SecureFailure('state');
		this.started = true;
		this.ephemeral = this.options.ephemeral ?? (await remoteKeys());
		this.nonce = this.options.nonce ?? randomBytes(16);
		return { ephemeralKey: toBase64Url(this.ephemeral.publicKey), nonce: toBase64Url(this.nonce) };
	}
	private async derive(
		peer: { ephemeralKey: string },
		deviceNonce: Uint8Array,
		hostNonce: Uint8Array,
		generation: number
	): Promise<void> {
		const { role, hostId, deviceId, staticKey, peerKey } = this.options;
		const shared = { role, hostId, deviceId, generation, staticKey, peerStatic: peerKey };
		try {
			const peerEphemeral = fromBase64Url(peer.ephemeralKey);
			const input = { ...shared, ephemeralKey: this.ephemeral!, peerEphemeral };
			this.keys = await sessionKeys({ ...input, deviceNonce, hostNonce });
		} catch {
			throw new SecureFailure('packet');
		}
	}
	private async sealNow(text: string, emit: (packet: SecurePacket) => void): Promise<void> {
		const keys = this.usable(),
			bytes = remoteBytes(text),
			chunk = this.options.limits?.chunkBytes ?? remoteLimits.chunkBytes,
			direction = directionOf(this.options.role, true);
		if (bytes.length > this.bound()) throw new SecureFailure('size');
		for (let offset = 0; offset === 0 || offset < bytes.length; offset += chunk) {
			const context = { direction, counter: this.sent++, more: offset + chunk < bytes.length };
			const part = bytes.subarray(offset, offset + chunk);
			const data = await sealPacket({ ...context, key: keys.send } as const, part);
			emit({ type: 'sealed', counter: context.counter, more: context.more, data });
		}
	}
	private async openNow(packet: SecurePacket): Promise<string | null> {
		const keys = this.usable(),
			direction = directionOf(this.options.role, false);
		if (packet.type !== 'sealed') return this.fail('packet');
		if (packet.counter !== this.received) return this.fail('counter');
		const { counter, more } = packet,
			context = { key: keys.receive, direction, counter, more } as const;
		const plain = await openPacket(context, packet.data).catch(() => this.fail('tag'));
		this.received++;
		this.parts.push(plain);
		this.size += plain.length;
		if (this.size > this.bound()) return this.fail('size');
		if (more) return null;
		const bytes = concatBytes(...this.parts.splice(0));
		this.size = 0;
		try {
			return bytesText(bytes);
		} catch {
			return this.fail('packet');
		}
	}
	private bound(): number {
		return this.options.limits?.messageBytes ?? remoteLimits.messageBytes;
	}
	private usable(): SessionKeys {
		if (!this.keys) throw new SecureFailure('state');
		return this.keys;
	}
	/** Any violation ends the channel: nothing more is opened or sealed with these keys. */
	private fail(reason: SecureFailureReason): never {
		this.keys = null;
		throw new SecureFailure(reason);
	}
}
