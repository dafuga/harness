import { registerPlugin } from '@capacitor/core';
import { CapacitorBridgeAdapter } from "./capacitor-bridge-adapter/CapacitorBridgeAdapter";
import type {
	Environment,
	RemoteMobileControl,
	RemoteNativeEvents,
	RemoteNativePlugin,
	RemoteNativeStatus
} from '../models/Environment.types';

export interface CapacitorEnvironmentAdapterConfig {
	/** A test hands in a plugin; the app registers the native one. */
	plugin?: RemoteNativePlugin;
}

export const remotePluginName = 'HarnessRemote';

/**
 * The iOS shell. One native plugin gives both the product interface and this phone's connection
 * to a computer; the page holds no socket, key or credential of its own.
 */
export class CapacitorEnvironmentAdapter {
	private readonly plugin: RemoteNativePlugin;
	constructor(config: CapacitorEnvironmentAdapterConfig = {}) {
		this.plugin = config.plugin ?? registerPlugin<RemoteNativePlugin>(remotePluginName);
	}

	connect(): Environment {
		const plugin = this.plugin;
		const bridge = new CapacitorBridgeAdapter({ plugin });
		/** What the bridge offers follows each status before anyone else hears of it. */
		const note = (status: RemoteNativeStatus) => {
			bridge.allow(status);
			return status;
		};
		const phone: RemoteMobileControl = {
			status: async () => note(await plugin.status()),
			scan: async (input) => note(await plugin.scan(input)),
			disconnect: async () => note(await plugin.disconnect()),
			onStatus: (listener) => this.listen('status', (status) => listener(note(status)))
		};
		return { kind: 'capacitor', bridge: bridge.connect(), local: false, phone };
	}

	private listen<K extends keyof RemoteNativeEvents>(
		name: K,
		listener: (value: RemoteNativeEvents[K]) => void
	): () => void {
		const handle = this.plugin.addListener(name, listener);
		return () => void handle.then((item) => item.remove());
	}
}
