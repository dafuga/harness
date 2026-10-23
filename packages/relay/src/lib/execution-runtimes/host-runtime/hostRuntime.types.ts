import type { HostObjectController } from './HostObjectController';
import type { SocketFrameService } from './socket-frame-service/SocketFrameService';
import type { PairingOfferService } from './PairingOfferService';

/** What one host object is made of: its requests, its frames and its alarm. */
export interface HostRuntime {
	http: HostObjectController;
	frames: SocketFrameService;
	offers: PairingOfferService;
}
