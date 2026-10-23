import type { RemoteDeviceSessionsService } from '../../src/services/RemoteDeviceSessionsService';
import type { SecurePacket } from '../../../remote/src/index';

export interface Side {
	sessions: RemoteDeviceSessionsService;
	inbox: Map<string, (packet: SecurePacket) => void>;
	hostId: string;
	hostKey: Uint8Array;
}
