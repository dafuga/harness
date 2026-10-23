import type { Device, Address } from './remote-relay-fixture.types';
import { credentialHash, randomId } from '../../remote/src/index';
import type {
	RelayHostCommand,
	RelayHostFrame,
	RemoteHostRegisterInput,
	RemoteSocket
} from '../../remote/src/index';
import { MemoryPairingDesk } from './remote-pairing-fixture';
import { socketEnd } from './remote-socket-fixture';
import type { SocketEnd } from './remote-socket-fixture';

const stamp = '2026-10-12T10:00:00.000Z';
const present = (devices: Map<string, Device>) =>
	[...devices].map(([deviceId, device]) => ({ deviceId, online: Boolean(device.end) }));

/** A relay in memory that follows the contract: hashes only, forwarding, pairing, revocation. */
export class MemoryRelay {
	readonly origin = 'https://relay.example';
	readonly registered: RemoteHostRegisterInput[] = [];
	readonly bearers: string[] = [];
	readonly commands: RelayHostCommand[] = [];
	readonly forwarded: string[] = [];
	refused = 0;
	private host: SocketEnd | null = null;
	private readonly devices = new Map<string, Device>();
	private readonly desk = new MemoryPairingDesk({
		host: () => this.current,
		toHost: (frame) => this.toHost(frame),
		issue: async (deviceId, credential) => {
			this.devices.get(deviceId)?.end?.shut(4401);
			const hash = await this.hashOf(deviceId, credential);
			this.devices.set(deviceId, { hash, end: null, connectionId: '' });
		}
	});
	readonly fetch = this.desk.fetch;
	register = async (input: RemoteHostRegisterInput) => {
		const generation = this.registered.push(input);
		return { hostId: input.hostId, origin: this.origin, generation, registeredAt: stamp };
	};
	open = (_url: string, headers: Record<string, string>): RemoteSocket => {
		const bearer = (headers.Authorization ?? '').replace('Bearer ', '');
		this.bearers.push(bearer);
		return headers['X-Harness-Role'] === 'host'
			? this.openHost(bearer)
			: this.openDevice(headers['X-Harness-Device'] ?? '', bearer);
	};
	private get current(): RemoteHostRegisterInput {
		return this.registered.at(-1) ?? { hostId: '', hostKey: '', credentialHash: '', name: '' };
	}
	private toHost(frame: RelayHostFrame): void {
		this.host?.deliver(frame);
	}
	private hashOf(deviceId: string, credential: string): Promise<string> {
		return credentialHash({ role: 'device', hostId: this.current.hostId, deviceId, credential });
	}
	private openHost(credential: string): RemoteSocket {
		const end = socketEnd(
			(text) => this.command(text),
			() => this.hostGone(end)
		);
		const { hostId } = this.current,
			opened = credentialHash({ role: 'host', hostId, credential }).then((hash) => {
				if (hash !== this.current.credentialHash) return this.refuse();
				this.host = end;
				this.toHost({ type: 'ready', hostId, devices: present(this.devices) });
				this.notice('host-online');
			});
		opened.catch(() => undefined);
		return { ...end.socket, opened };
	}
	private openDevice(deviceId: string, credential: string): RemoteSocket {
		const address = { deviceId, connectionId: randomId(16) };
		const end = socketEnd(
			(text) => this.fromDevice(address, text, end),
			() => this.deviceGone(address, end)
		);
		const opened = this.hashOf(deviceId, credential).then((hash) => {
			const device = this.devices.get(deviceId);
			if (device?.hash !== hash) return this.refuse();
			device.end?.shut(4409);
			Object.assign(device, { end, connectionId: address.connectionId });
			this.toHost({ type: 'device-open', ...address });
		});
		opened.catch(() => undefined);
		return { ...end.socket, opened };
	}
	private refuse(): never {
		this.refused++;
		throw new Error('credential-invalid');
	}
	private hostGone(end: SocketEnd): void {
		if (this.host !== end) return;
		this.host = null;
		this.notice('host-offline');
	}
	private deviceGone(address: Address, end: SocketEnd): void {
		const device = this.devices.get(address.deviceId);
		if (device?.end !== end) return;
		device.end = null;
		this.toHost({ type: 'device-close', ...address });
	}
	private notice(event: 'host-online' | 'host-offline'): void {
		for (const device of this.devices.values()) device.end?.deliver({ type: 'relay', event });
	}
	private fromDevice(address: Address, text: string, end: SocketEnd): void {
		if (text === 'ping') return end.text('pong');
		this.forwarded.push(text);
		if (!this.host) return end.deliver({ type: 'relay', event: 'host-offline' });
		this.toHost({ type: 'packet', ...address, packet: JSON.parse(text) } as RelayHostFrame);
	}
	private command(text: string): void {
		if (text === 'ping') return this.host?.text('pong');
		const command = JSON.parse(text) as RelayHostCommand;
		this.commands.push(command);
		if (command.type === 'packet' || command.type === 'device-drop') return this.toDevice(command);
		const revoking = command.type === 'device-revoke',
			ok = revoking ? this.revoke(command.deviceId) : this.desk.apply(command);
		this.toHost({ type: 'ack', ref: command.ref, ok });
	}
	/** Only the connection a command names is written to or closed: late packets go nowhere. */
	private toDevice(command: Extract<RelayHostCommand, { type: 'packet' | 'device-drop' }>): void {
		const device = this.devices.get(command.deviceId);
		if (device?.connectionId !== command.connectionId) return;
		if (command.type === 'device-drop') device.end?.shut(command.code);
		else device.end?.deliver(command.packet);
	}
	private revoke(deviceId: string): boolean {
		const device = this.devices.get(deviceId);
		this.devices.delete(deviceId);
		device?.end?.shut(4401);
		return Boolean(device);
	}
}
