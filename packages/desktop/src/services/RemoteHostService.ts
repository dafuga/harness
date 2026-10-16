import { hostname } from 'node:os';
import type { RemoteHostStatus, RemoteKeyPair, RemoteSocket } from '../../../remote/src/index';
import type { RemoteHostState, RemoteHostStoreAdapter } from '../adapters/RemoteHostStoreAdapter';
import type { RegisterRemoteHost } from '../utils/remoteHostIdentity';
import { remoteHostStatus } from '../utils/remoteHostStatus';
import type { RemoteDeviceSessionsOptions } from './RemoteDeviceSessionsService';
import { RemoteHostRecordService } from './RemoteHostRecordService';
import { RemoteHostRuntimeService } from './RemoteHostRuntimeService';
import type { RelayLinkTuning } from './RemoteHostRuntimeService';
import { RemoteHostSwitchService } from './RemoteHostSwitchService';
import { RemotePairingControlService } from './RemotePairingControlService';

export interface RemoteHostOptions {
	store: RemoteHostStoreAdapter;
	/** Registers this computer under the signed-in hosted identity; rejects when there is none. */
	register: RegisterRemoteHost;
	open: (url: string, headers: Record<string, string>) => RemoteSocket;
	shared: RemoteDeviceSessionsOptions['shared'];
	name?: () => string;
	link?: RelayLinkTuning;
	/** Whether the screen is locked, once that is known. */
	locked?: () => boolean | undefined;
}
/**
 * Remote access of this computer: off until the person turns it on, and only with OS encryption.
 * `screen` tells connected phones that the screen was locked or unlocked and changes nothing else.
 * `suspend` is system suspension: offline until `resume`, with sessions and runs kept. `stop` is
 * Quit: the socket closes and the phones' runs are cancelled; the approvals stay stored.
 * Launch, on, off and Quit go through the switch, which keeps a late answer from undoing them.
 */
export class RemoteHostService {
	readonly devices: RemotePairingControlService;
	private readonly record: RemoteHostRecordService;
	private readonly turns: RemoteHostSwitchService;
	private runtime: RemoteHostRuntimeService | null = null;
	private readonly listeners = new Set<(status: RemoteHostStatus) => void>();
	constructor(private readonly options: RemoteHostOptions) {
		this.record = new RemoteHostRecordService(options.store);
		this.turns = new RemoteHostSwitchService({
			record: this.record,
			register: options.register,
			name: () => this.name(),
			run: (state, keys) => this.run(state, keys),
			close: () => this.close(),
			changed: () => this.changed()
		});
		this.devices = new RemotePairingControlService(this, options.shared.registry);
	}
	enabled(): boolean {
		return this.record.value?.enabled === true;
	}
	name(): string {
		return this.options.name ? this.options.name() : hostname();
	}
	onStatus(listener: (status: RemoteHostStatus) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	/** At launch: an enabled host goes online again with what is stored. Nothing is registered. */
	start(): Promise<void> {
		return this.turns.start();
	}
	async enable(): Promise<RemoteHostStatus> {
		if (!this.record.available()) return this.status();
		await this.turns.enable();
		return this.published();
	}
	async disable(): Promise<RemoteHostStatus> {
		await this.turns.disable();
		return this.published();
	}
	screen(locked: boolean): void {
		const state = locked ? 'locked' : 'unlocked';
		this.runtime?.sessions.announce('connection', { kind: 'host', state });
	}
	suspend(): void {
		this.runtime?.stop();
	}
	resume(): void {
		this.runtime?.start();
	}
	async stop(): Promise<void> {
		await this.turns.stop();
		await this.published();
	}
	async status(): Promise<RemoteHostStatus> {
		const { runtime } = this,
			{ phase, reason } = this.turns,
			{ value: state } = this.record,
			supported = this.record.available(),
			projects = await this.options.shared.registry.list().catch(() => []);
		return remoteHostStatus({
			supported,
			state,
			runtime,
			phase,
			reason,
			name: this.name(),
			projects
		});
	}
	current(): { state: RemoteHostState; runtime: RemoteHostRuntimeService } {
		const { value: state } = this.record;
		if (!state || !state.enabled || !this.runtime) throw new Error('Turn remote access on first.');
		return { state, runtime: this.runtime };
	}
	async published(): Promise<RemoteHostStatus> {
		const status = await this.status();
		for (const listener of [...this.listeners]) listener(status);
		return status;
	}
	/** Writes the record in its turn, after every change asked before. */
	async saved(): Promise<RemoteHostStatus> {
		await this.record.save();
		return this.published();
	}
	private changed(): void {
		void this.published().catch(() => undefined);
	}
	private close(): void {
		this.runtime?.end();
		this.runtime = null;
	}
	private run(state: RemoteHostState, keys: RemoteKeyPair): void {
		const { open, shared, link, locked } = this.options,
			quietly = (work: Promise<unknown>) => void work.catch(() => undefined);
		this.close();
		this.runtime = new RemoteHostRuntimeService({
			state,
			keys,
			name: this.name(),
			open,
			shared,
			link,
			locked,
			changed: () => this.changed(),
			ready: () => quietly(this.devices.flush().then(() => this.saved())),
			revoked: (deviceId) => quietly(this.devices.dropped(deviceId)),
			seen: (deviceId) => quietly(this.devices.seen(deviceId))
		});
		this.runtime.start();
	}
}
