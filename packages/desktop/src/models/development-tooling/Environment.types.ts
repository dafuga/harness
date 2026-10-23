import type { RemoteDesktopControl } from '../../../../remote/src/models/RemoteControl.types';
import type { RemoteMobileControl } from '../../../../remote/src/models/RemoteControl.types';
import type { RemoteMobileStatus } from '../../../../remote/src/models/RemoteControl.types';
import type { DesktopBridge } from './DesktopBridge.types';
import type { RemoteMethod } from '../../../../remote/src/models/Remote.types';
import type { WireChannel } from '../../../../remote/src/models/Remote.types';
import type { NativeHostedStatus } from '../projects-sessions/ProjectContext.types';

export type EnvironmentKind = 'electron' | 'capacitor' | 'web';

/** The control port of this runtime, if it has one: never both. */
export interface RemotePorts {
	/** Electron only: phone access to this computer. Public metadata, no credential. */
	host?: RemoteDesktopControl;
	/** Capacitor only: this phone's connection to a computer. */
	phone?: RemoteMobileControl;
}

/** What one runtime gives the one renderer. Exactly one adapter is chosen when a page starts. */
export interface Environment extends RemotePorts {
	kind: EnvironmentKind;
	/** The typed product interface; absent where a page is a preview. */
	bridge: DesktopBridge | undefined;
	/** Whether a folder of this device can be added as a project. */
	local: boolean;
	/** Capacitor only: this phone has a Hub account of its own, read without any computer. */
	account?: boolean;
}

/** What a page can see of its host besides the document. */
export interface EnvironmentHost {
	harness?: DesktopBridge;
	harnessRemote?: Partial<RemoteDesktopControl>;
	Capacitor?: { isNativePlatform?: () => boolean };
}

/** All the page hands the scanner: the name of this phone. It never holds an offer. */
export type ScanInput = Parameters<RemoteMobileControl['scan']>[0];

/**
 * What the plugin reports: the published status, and beside it what the computer said when it
 * attached this phone: the methods it allowed, and whether its screen is locked. Each is absent
 * where it is not known; an absent lock state is unknown, never unlocked.
 */
export type RemoteNativeStatus = RemoteMobileStatus & {
	methods?: RemoteMethod[];
	locked?: boolean;
	/** Only a Debug build that was started for a local test fixture says this; a release never. */
	fixture?: boolean;
};

/** An answer of the computer, or the copy the phone kept of one with the time it was saved. */
export interface RemoteNativeAnswer {
	value: unknown;
	cachedAt?: string | null;
}

/** One event of the computer as the plugin hands it on: decrypted, in order, never twice. */
export interface RemoteNativeEvent {
	channel: WireChannel;
	sequence: number;
	value: unknown;
}

export interface RemoteNativeEvents {
	status: RemoteNativeStatus;
	event: RemoteNativeEvent;
}

/**
 * The `HarnessRemote` plugin as the page sees it. The Swift side owns the socket, the keys, the
 * credential, the encryption and the saved copies; none of them crosses this interface.
 */
export interface RemoteNativePlugin {
	status(): Promise<RemoteNativeStatus>;
	/** Rejects with one of `remoteScanFailures` as its code when a scan ends without an offer. */
	scan(input: ScanInput): Promise<RemoteNativeStatus>;
	disconnect(): Promise<RemoteNativeStatus>;
	request(call: { method: string; input: Record<string, unknown> }): Promise<RemoteNativeAnswer>;
	addListener<K extends keyof RemoteNativeEvents>(
		eventName: K,
		listener: (value: RemoteNativeEvents[K]) => void
	): Promise<{ remove(): Promise<void> }>;
}

/** One call of the page to its Hub account: a path of the project API, its fields and its body. */
export interface AccountNativeCall {
	method: 'GET' | 'POST';
	path: string;
	query?: Record<string, string>;
	body?: unknown;
}

/** What the Hub answered, as the plugin hands it on: its status, its media type, base64 bytes. */
export interface AccountNativeReply {
	status: number;
	contentType: string;
	data: string;
}

/** A status as the plugin states it; the page keeps only the public fields of NativeHostedStatus. */
export type AccountNativeStatus = Omit<NativeHostedStatus, 'state'> & { state: string };

/**
 * The `HarnessAccount` plugin as the page sees it. The Swift side owns the Hub origin, the
 * verifier, the nonce and the session, and signs every call; none of them crosses this interface.
 */
export interface AccountNativePlugin {
	status(): Promise<AccountNativeStatus>;
	connect(): Promise<AccountNativeStatus>;
	disconnect(): Promise<AccountNativeStatus>;
	request(call: AccountNativeCall): Promise<AccountNativeReply>;
}
export {
	type RemoteBinary,
	type RemoteGrant,
	type RemoteMethod,
	type RemoteRevision,
	type WireChannel,
	type RemoteDesktopControl,
	type RemoteDeviceInfo,
	type RemoteHostStatus,
	type RemoteMobileControl,
	type RemoteMobileStatus,
	type RemotePairingOffer,
	type RemotePairingRequest,
	remoteContext
} from './EnvironmentValues';
