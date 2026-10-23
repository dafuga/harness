export type {
	RemoteBinary,
	RemoteGrant,
	RemoteMethod,
	RemoteRevision,
	WireChannel
} from '../../../../remote/src/models/Remote.types';
export type {
	RemoteDesktopControl,
	RemoteDeviceInfo,
	RemoteHostStatus,
	RemoteMobileControl,
	RemoteMobileStatus,
	RemotePairingOffer,
	RemotePairingRequest
} from '../../../../remote/src/models/RemoteControl.types';

/** Where the page keeps its two connection stores for the components below it. */
export const remoteContext = 'harness:remote';
