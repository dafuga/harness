// @harness-uid u_ddpgjue5tc
import { RemoteHostUnavailableError, type RemoteHostOptions } from './RemoteHostService.types';
import { hostname } from 'node:os';
import type { RemoteHostStatus, RemoteKeyPair } from '../../../../../remote/src/index';
import type { RemoteHostState } from '../../../adapters/networking-security/RemoteHostStoreAdapter';
import { remoteHostStatus } from './remoteHostStatus';
import { RemoteHostRecordService } from './RemoteHostRecordService';
import { RemoteHostAccountService } from './RemoteHostAccountService';
import { RemoteHostRuntimeService } from './RemoteHostRuntimeService';
import { RemoteHostSwitchService } from './remote-host-switch-service/RemoteHostSwitchService';
import { RemotePairingControlService } from './RemotePairingControlService';

function hostRuntime(
	state: RemoteHostState,
	keys: RemoteKeyPair,
	options: RemoteHostOptions,
	host: RemoteHostService
) {
	const { open, shared, link, locked } = options,
		quietly = (work: Promise<unknown>) => void work.catch(() => undefined);
	return new RemoteHostRuntimeService({
		state,
		keys,
		name: host.name(),
		open,
		shared,
		link,
		locked,
		changed: () => quietly(host.published()),
		unlinked: state.ownerId ? () => host.relayUnlinked(state) : undefined,
		accountRequest: (runtime, request) => quietly(host.devices.approveAccount(runtime, request)),
		ready: () => quietly(host.devices.flush().then(() => host.saved())),
		revoked: (deviceId) => quietly(host.devices.dropped(deviceId)),
		seen: (deviceId) => quietly(host.devices.seen(deviceId))
	});
}

/** Runs the account-linked host and reports its current state to the desktop. */
export class RemoteHostService {
	readonly devices: RemotePairingControlService;
	private readonly record: RemoteHostRecordService;
	private readonly turns: RemoteHostSwitchService;
	private readonly account: RemoteHostAccountService;
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
		this.account = new RemoteHostAccountService(
			this.record,
			this.turns,
			() => this.changed(),
			options.unregister
		);
		this.devices = new RemotePairingControlService(this, options.shared.registry);
	}
	enabled(): boolean {
		return this.active()?.enabled === true;
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
		return this.options.accountOnly ? Promise.resolve() : this.turns.start();
	}
	async enable(): Promise<RemoteHostStatus> {
		if (!this.record.available() || (this.options.accountOnly && !this.account.ownerId))
			return this.status();
		await this.turns.enable(this.account.ownerId);
		return this.published();
	}
	async disable(): Promise<RemoteHostStatus> {
		const owner = this.account.ownerId;
		await this.account.unlink();
		if (owner !== this.account.ownerId) return this.status();
		await this.turns.disable();
		return this.published();
	}
	linkAccount(ownerId: string): void {
		this.account.link(ownerId, Boolean(this.runtime));
	}
	endAccount(): void {
		this.account.end();
	}
	relayUnlinked(state: RemoteHostState): void {
		this.account.relayUnlinked(state);
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
			state = this.active(),
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
		if (!state || !state.enabled || !this.runtime)
			throw new RemoteHostUnavailableError('Turn remote access on first.');
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
	private active() {
		const { value } = this.record;
		const { ownerId } = this.account;
		return !this.options.accountOnly || (ownerId && value?.ownerId === ownerId) ? value : null;
	}
	private changed(): void {
		void this.published().catch(() => undefined);
	}
	private close(): void {
		this.runtime?.end();
		this.runtime = null;
	}
	private run(state: RemoteHostState, keys: RemoteKeyPair): void {
		this.close();
		this.runtime = hostRuntime(state, keys, this.options, this);
		this.runtime.start();
	}
}

export type { RemoteHostOptions } from './RemoteHostService.types';
