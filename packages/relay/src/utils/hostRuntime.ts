import { HostSocketsAdapter } from '../adapters/HostSocketsAdapter';
import { HostStorageAdapter } from '../adapters/HostStorageAdapter';
import { HostObjectController } from '../controllers/HostObjectController';
import { ManageController } from '../controllers/ManageController';
import { PairingController } from '../controllers/PairingController';
import type { HostScope, RelayEnv } from '../models/RelayHost.types';
import { DeviceRevocationService } from '../services/DeviceRevocationService';
import { HostCommandService } from '../services/HostCommandService';
import { HostLinkService } from '../services/HostLinkService';
import { HostRegistryService } from '../services/HostRegistryService';
import { PairingAccessService } from '../services/PairingAccessService';
import { PairingExchangeService } from '../services/PairingExchangeService';
import { PairingOfferService } from '../services/PairingOfferService';
import { RateLimitService } from '../services/RateLimitService';
import { SocketAcceptService } from '../services/SocketAcceptService';
import { SocketFrameService } from "../services/socket-frame-service/SocketFrameService";

/** What one host object is made of: its requests, its frames and its alarm. */
export interface HostRuntime {
	http: HostObjectController;
	frames: SocketFrameService;
	offers: PairingOfferService;
}

/**
 * Wires one host object. Nothing is read here: an object that wakes for one frame pays for
 * nothing but the frame.
 */
export function hostRuntime(state: DurableObjectState, env: RelayEnv): HostRuntime {
	const scope: HostScope = {
		owns: (hostId) => env.REMOTE_HOSTS.idFromName(hostId).equals(state.id)
	};
	const store = new HostStorageAdapter(state.storage);
	const sockets = new HostSocketsAdapter(state);
	const link = new HostLinkService(store, sockets);
	const rate = new RateLimitService(store);
	const offers = new PairingOfferService(store);
	const revocation = new DeviceRevocationService(store, sockets, link);
	const access = new PairingAccessService(store, offers, link);
	const exchanges = new PairingExchangeService(store, sockets, link);
	const manage = new ManageController(
		scope,
		store,
		new HostRegistryService(store, sockets, link),
		revocation
	);
	const pairing = new PairingController(store, rate, access, exchanges);
	const accept = new SocketAcceptService(store, sockets, link, rate);
	const commands = new HostCommandService(sockets, link, offers, revocation);
	return {
		http: new HostObjectController(scope, manage, pairing, accept),
		frames: new SocketFrameService(sockets, link, commands),
		offers
	};
}
