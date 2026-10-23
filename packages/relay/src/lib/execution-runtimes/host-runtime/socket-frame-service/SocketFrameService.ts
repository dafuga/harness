import { relayCloseCodes, SecurePacketValidator } from '../../../../../../remote/src/index';
import type { RelayNotice, SecureHello, SecureSealed } from '../../../../../../remote/src/index';
import type { HostSocketsAdapter } from '../HostSocketsAdapter';
import { relayConfig } from '../../../../configs/networking-security/relayConfig';
import type {
	DeviceAttachment,
	RateRecord
} from '../../../../models/networking-security/RelayHost.types';
import { frameTooLarge } from './frameTooLarge';
import type { HostCommandService } from '../HostCommandService';
import type { HostLinkService } from '../HostLinkService';

const hostOffline: RelayNotice = { type: 'relay', event: 'host-offline' };

/** Every frame and every close of every socket of a host object. */
export class SocketFrameService {
	private readonly validator = new SecurePacketValidator();
	/** Frames per connection and window. Flood control only: nothing here decides who may speak. */
	private readonly windows = new WeakMap<WebSocket, RateRecord>();

	constructor(
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService,
		private readonly commands: HostCommandService
	) {}

	/** Text frames within the size limit only; anything else ends the socket. */
	async message(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const attachment = this.sockets.attachment(socket);
		if (!attachment || attachment.closed) return;
		if (frameTooLarge(message)) return this.link.drop(socket, relayCloseCodes.tooLarge);
		if (typeof message !== 'string') return this.link.drop(socket, relayCloseCodes.protocol);
		if (attachment.role === 'host') return this.commands.handle(socket, message);
		if (this.flooded(socket)) return this.link.drop(socket, relayCloseCodes.rateLimited);
		this.forward(socket, attachment, message);
	}

	/** The peer closed the socket, or it failed. */
	closed(socket: WebSocket): void {
		this.link.drop(socket, 1000);
	}

	/**
	 * A device sends `hello` and `sealed` packets and nothing else. They go to the host under the
	 * ids the relay gave this connection. While the host is away they are dropped and answered.
	 */
	private forward(socket: WebSocket, attachment: DeviceAttachment, text: string): void {
		const packet = this.parse(text);
		if (!packet) return this.link.drop(socket, relayCloseCodes.protocol);
		const { deviceId, connectionId } = attachment;
		const delivered = this.link.toHost({ type: 'packet', deviceId, connectionId, packet });
		if (!delivered) this.sockets.send(socket, hostOffline);
	}

	private parse(text: string): SecureHello | SecureSealed | undefined {
		try {
			const packet = this.validator.packet(JSON.parse(text));
			return packet.type === 'hello' || packet.type === 'sealed' ? packet : undefined;
		} catch {
			return undefined;
		}
	}

	private flooded(socket: WebSocket): boolean {
		const now = Date.now();
		const stored = this.windows.get(socket);
		const current = stored !== undefined && now - stored.startedAt < relayConfig.frameWindowMs;
		const window = current ? stored : { startedAt: now, count: 0 };
		window.count += 1;
		this.windows.set(socket, window);
		return window.count > relayConfig.deviceFrames;
	}
}
