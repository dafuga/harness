// @harness-uid u_zbflrtevgf
import { powerMonitor, safeStorage } from 'electron';
import { resolve } from 'node:path';
import type { DesktopRemoteOptions } from './desktopRemote.types';
import { RemoteHostService } from '../../../../services/networking-security/remote-host-service/RemoteHostService';
import { RemoteLifecycleService } from '../RemoteLifecycleService';
import { NativeSessionAdapter } from '../../../../adapters/networking-security/NativeSessionAdapter';
import { RelaySocketAdapter } from '../../../../adapters/networking-security/RelaySocketAdapter';
import { RemoteHostStoreAdapter } from '../../../../adapters/networking-security/RemoteHostStoreAdapter';
import { RemoteRegistrationAdapter } from '../RemoteRegistrationAdapter';
import { liveQuotaSources } from '../tracker-overview-publisher/liveQuotaSources';
import { createHomeChatWriter } from '../tracker-overview-publisher/createHomeChatWriter';
import { createHomeSnapshotReader } from '../tracker-overview-publisher/createHomeSnapshotReader';

/** Owns the Mac's relay connection and power events for the lifetime of the main process. */
export function desktopRemote(options: DesktopRemoteOptions) {
	const { directory, origin, sessionFile, stores } = options;
	const hosted = new NativeSessionAdapter(sessionFile, safeStorage),
		registration = new RemoteRegistrationAdapter({ origin, credentials: () => hosted.read() }),
		sockets = new RelaySocketAdapter(),
		screen: { locked?: boolean } = {};
	const phoneWriteDevice = process.env.HARNESS_TRACKER_PHONE_WRITE_DEVICE?.trim();
	const phoneWriteToken = process.env.HARNESS_TRACKER_PHONE_WRITE_TOKEN;
	const home = createHomeSnapshotReader(
		process.env.HARNESS_HUB_HOME_PROVIDER_FILE,
		liveQuotaSources()
	);
	const homeChat = createHomeChatWriter();
	const remote = new RemoteHostService({
		store: new RemoteHostStoreAdapter({
			file: resolve(directory, 'remote.enc'),
			encryption: safeStorage
		}),
		accountOnly: true,
		register: (input, ownerId) => registration.register(input, ownerId),
		unregister: (hostId, ownerId) => registration.unregister(hostId, ownerId),
		open: (url, headers) => sockets.open(url, headers),
		shared: {
			...stores,
			home,
			homeChat,
			trackerPhone: process.env.HARNESS_TRACKER_PHONE_DEVICE?.trim(),
			trackerWrite:
				phoneWriteDevice && phoneWriteToken
					? { device: phoneWriteDevice, token: phoneWriteToken }
					: undefined
		},
		locked: () => screen.locked
	});
	remote.onStatus(options.onStatus);
	const lifecycle = new RemoteLifecycleService({
		power: { on: (event, listener) => powerMonitor.on(event as 'suspend', listener) },
		host: remote,
		cancelLocal: options.cancelLocal,
		screen: (locked) => {
			screen.locked = locked;
			remote.screen(locked);
		}
	});
	lifecycle.start();
	return { remote, lifecycle, home, homeChat };
}
