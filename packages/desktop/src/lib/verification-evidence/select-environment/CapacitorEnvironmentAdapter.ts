import type { CapacitorEnvironmentAdapterConfig } from './CapacitorEnvironmentAdapter.types';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CapacitorAccountAdapter } from './capacitor-account-adapter/CapacitorAccountAdapter';
import { CapacitorBridgeAdapter } from './capacitor-bridge-adapter/CapacitorBridgeAdapter';
import { CapacitorProjectsService } from './CapacitorProjectsService';
import type {
	AccountNativePlugin,
	Environment,
	RemoteMobileControl,
	RemoteNativeEvents,
	RemoteNativePlugin,
	RemoteNativeStatus
} from '../../../models/development-tooling/Environment.types';

export const remotePluginName = 'HarnessRemote';

export const accountPluginName = 'HarnessAccount';

function nativeAccount(): AccountNativePlugin | undefined {
	if (!Capacitor.isPluginAvailable(accountPluginName)) return undefined;
	return registerPlugin<AccountNativePlugin>(accountPluginName);
}

/**
 * The iOS shell. One native plugin gives both the product interface and this phone's connection
 * to a computer; another, where the shell has it, this phone's own Hub account. The page holds
 * no socket, key or credential of its own.
 */
export class CapacitorEnvironmentAdapter {
	private readonly plugin: RemoteNativePlugin;
	private readonly account: AccountNativePlugin | undefined;
	constructor(config: CapacitorEnvironmentAdapterConfig = {}) {
		this.plugin = config.plugin ?? registerPlugin<RemoteNativePlugin>(remotePluginName);
		this.account = 'account' in config ? config.account : nativeAccount();
	}

	connect(): Environment {
		const plugin = this.plugin;
		const computer = new CapacitorBridgeAdapter({ plugin });
		/** What the bridge offers follows each status before anyone else hears of it. */
		const note = (status: RemoteNativeStatus) => {
			computer.allow(status);
			return status;
		};
		const phone: RemoteMobileControl = {
			status: async () => note(await plugin.status()),
			scan: async (input) => note(await plugin.scan(input)),
			disconnect: async () => note(await plugin.disconnect()),
			onStatus: (listener) => this.listen('status', (status) => listener(note(status)))
		};
		const mac = computer.connect();
		if (!this.account) return { kind: 'capacitor', bridge: mac, local: false, phone };
		/** The account is read at once, paired or not; the computer's projects join it once reached. */
		const cloud = new CapacitorAccountAdapter({ plugin: this.account }).connect();
		const bridge = new CapacitorProjectsService({ cloud, mac }).connect();
		return { kind: 'capacitor', bridge, local: false, phone, account: true };
	}

	private listen<K extends keyof RemoteNativeEvents>(
		name: K,
		listener: (value: RemoteNativeEvents[K]) => void
	): () => void {
		const handle = this.plugin.addListener(name, listener);
		return () => void handle.then((item) => item.remove());
	}
}

export type { CapacitorEnvironmentAdapterConfig } from './CapacitorEnvironmentAdapter.types';
