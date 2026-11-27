// @harness-uid u_whsort2vvn
import type { CapacitorEnvironmentAdapterConfig } from './CapacitorEnvironmentAdapter.types';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { CapacitorAccountAdapter } from './capacitor-account-adapter/CapacitorAccountAdapter';
import { CapacitorBridgeAdapter } from './capacitor-bridge-adapter/CapacitorBridgeAdapter';
import { CapacitorProjectsService } from './CapacitorProjectsService';
import type {
	OwnerHomeSnapshot,
	HomeChatReceipt,
	TrackerHomeSource
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import { phoneTrackerTools } from './phoneTrackerTools';
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

export const vaultPluginName = 'HarnessVault';

/** Offers the native Vault, only in a shell that ships it. */
function offerVault(phone: RemoteMobileControl): void {
	if (!Capacitor.isPluginAvailable(vaultPluginName)) return;
	const vault = registerPlugin<{ open(): Promise<void> }>(vaultPluginName);
	phone.openVault = () => vault.open();
}

function nativeAccount(): AccountNativePlugin | undefined {
	if (!Capacitor.isPluginAvailable(accountPluginName)) return undefined;
	return registerPlugin<AccountNativePlugin>(accountPluginName);
}

function offerAccountComputers(
	phone: RemoteMobileControl,
	plugin: RemoteNativePlugin,
	note: (status: RemoteNativeStatus) => RemoteNativeStatus
) {
	if (!plugin.computers || !plugin.connectAccountComputer) return;
	const list = plugin.computers.bind(plugin);
	const connect = plugin.connectAccountComputer.bind(plugin);
	phone.computers = async () => (await list()).computers;
	phone.connectAccountComputer = async (input) => note(await connect(input));
}

function phoneHome(plugin: RemoteNativePlugin): TrackerHomeSource {
	return {
		read: async () =>
			(await plugin.request({ method: 'homeSnapshot', input: {} })).value as OwnerHomeSnapshot,
		send: async (message) =>
			(await plugin.request({ method: 'homeChat', input: { ...message } })).value as HomeChatReceipt
	};
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
			disconnect: async () => note(await plugin.disconnect()),
			onStatus: (listener) => this.listen('status', (status) => listener(note(status)))
		};
		const mac = computer.connect();
		if (this.account) offerAccountComputers(phone, plugin, note);
		offerVault(phone);
		const tracker = phoneTrackerTools(plugin);

		const local = {
			kind: 'capacitor',
			local: false,
			trackerHome: phoneHome(plugin),
			phone,
			...(tracker ? { tracker } : {})
		} as const;
		if (!this.account) return { ...local, bridge: mac };
		const cloud = new CapacitorAccountAdapter({ plugin: this.account }).connect();
		const bridge = new CapacitorProjectsService({
			cloud,
			mac
		}).connect();
		return { ...local, bridge, account: true };
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
