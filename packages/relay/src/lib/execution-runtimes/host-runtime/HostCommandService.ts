import { relayCloseCodes } from '../../../../../remote/src/index';
import type { RelayErrorCode, RelayHostCommand } from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import { HostCommandValidator } from '../../../validators/development-tooling/HostCommandValidator';
import type { DeviceRevocationService } from './DeviceRevocationService';
import type { HostLinkService } from './HostLinkService';
import type { PairingOfferService } from './PairingOfferService';

type Acknowledged = Extract<RelayHostCommand, { ref: string }>;
interface Address {
	deviceId: string;
	connectionId: string;
}

/** What the host asks of the relay over its socket. */
export class HostCommandService {
	private readonly validator = new HostCommandValidator();

	constructor(
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService,
		private readonly offers: PairingOfferService,
		private readonly revocation: DeviceRevocationService
	) {}

	/** A frame that is not a command of the contract ends the socket (4400). */
	async handle(socket: WebSocket, text: string): Promise<void> {
		const command = this.parse(text);
		if (!command) return this.link.drop(socket, relayCloseCodes.protocol);
		if (command.type === 'packet') return this.deliver(command, command.packet);
		if (command.type === 'device-drop') return this.disconnect(command, command.code);
		const error = await this.run(command);
		const result = error ? { ok: false, error } : { ok: true };
		this.sockets.send(socket, { type: 'ack', ref: command.ref, ...result });
	}

	private parse(text: string): RelayHostCommand | undefined {
		try {
			return this.validator.command(JSON.parse(text));
		} catch {
			return undefined;
		}
	}

	private async run(command: Acknowledged): Promise<RelayErrorCode | undefined> {
		switch (command.type) {
			case 'pairing-open':
				return this.offers.open(command.pairingId, command.expiresAt);
			case 'pairing-approve':
				return this.offers.approve(command);
			case 'pairing-deny':
				return this.offers.deny(command.pairingId);
			case 'pairing-close':
				return this.offers.close(command.pairingId);
			case 'device-revoke':
				this.revocation.revoke(command.deviceId);
				return undefined;
		}
	}

	/** A packet reaches the connection it names. A late one for another connection is dropped. */
	private deliver(address: Address, packet: unknown): void {
		const target = this.connection(address);
		if (target) this.sockets.send(target, packet);
	}

	private disconnect(address: Address, code: number): void {
		const target = this.connection(address);
		if (target) this.link.drop(target, code);
	}

	/** The open connection an address names, if it is a connection of the device it names. */
	private connection(address: Address): WebSocket | undefined {
		const socket = this.sockets.connection(address.connectionId);
		const attachment = socket ? this.sockets.attachment(socket) : undefined;
		const named = attachment?.role === 'device' && attachment.deviceId === address.deviceId;
		return named ? socket : undefined;
	}
}
