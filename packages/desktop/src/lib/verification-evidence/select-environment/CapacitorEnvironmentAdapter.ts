// @harness-uid u_whsort2vvn
import type { CapacitorEnvironmentAdapterConfig } from './CapacitorEnvironmentAdapter.types';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CapacitorAccountAdapter } from './capacitor-account-adapter/CapacitorAccountAdapter';
import { CapacitorBridgeAdapter } from './capacitor-bridge-adapter/CapacitorBridgeAdapter';
import { CapacitorProjectsService } from './CapacitorProjectsService';
import { phoneTrackerTools } from './phoneTrackerTools';
import type {
	AccountNativePlugin,
	Environment,
	RemoteMobileControl,
	RemoteNativeEvents,
	RemoteNativePlugin,
	RemoteNativeStatus,
	SessionNativePlugin
} from '../../../models/development-tooling/Environment.types';

export const remotePluginName = 'HarnessRemote';

const sessionPluginName = 'HarnessSession';

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
		if (this.account && plugin.computers && plugin.connectAccountComputer) {
			const list = plugin.computers.bind(plugin);
			const connect = plugin.connectAccountComputer.bind(plugin);
			phone.computers = async () => (await list()).computers;
			phone.connectAccountComputer = async (input) => note(await connect(input));
		}
		const tracker = phoneTrackerTools(plugin);

		const local = {
			kind: 'capacitor',
			local: false,
			phone,
			...(tracker ? { tracker } : {}),
			...this.sessionPort()
		} as const;
		if (!this.account) return { ...local, bridge: mac };
		const cloud = new CapacitorAccountAdapter({ plugin: this.account }).connect();
		const bridge = new CapacitorProjectsService({
			cloud,
			mac
		}).connect();
		return { ...local, bridge, account: true };
	}

	private sessionPort(): Pick<Environment, 'sessions'> {
		if (!this.account || !Capacitor.isPluginAvailable(sessionPluginName)) return {};
		return { sessions: registerPlugin<SessionNativePlugin>(sessionPluginName) };
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
