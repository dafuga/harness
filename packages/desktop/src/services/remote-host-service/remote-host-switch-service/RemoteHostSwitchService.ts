import { importRemoteKeys } from '../../../../../remote/src/index';
import type { RemoteKeyPair } from '../../../../../remote/src/index';
import type { RemoteHostState } from '../../../adapters/RemoteHostStoreAdapter';
import { registerRemoteHost, remoteHostIdentity } from './remoteHostIdentity';
import type { RegisterRemoteHost } from '../../../utils/remoteHostIdentity';
import type { RemoteHostPhase } from '../../../utils/remoteHostStatus';
import type { RemoteHostRecordService } from '../RemoteHostRecordService';

export interface RemoteHostSwitchOptions {
	record: RemoteHostRecordService;
	/** Registers this computer under the signed-in hosted identity; rejects when there is none. */
	register: RegisterRemoteHost;
	name: () => string;
	/** The host goes online with this registration, in place of one that runs. */
	run: (state: RemoteHostState, keys: RemoteKeyPair) => void;
	/** The running host ends. */
	close: () => void;
	/** Told when what the status shows changes while a request is still under way. */
	changed: () => void;
}

type Shown = [RemoteHostPhase, string | null];

const unregistered = 'Remote access could not be registered. Try again.';

const quiet: Shown = ['idle', null];

/** How a registration that failed is shown: never in the words of the failure. */
function refused(error: unknown): Shown {
	const signedOut = Boolean((error as { signedOut?: boolean }).signedOut);
	return signedOut ? ['signed-out', null] : ['idle', unregistered];
}

/**
 * The switch of remote access: launch, turning on, turning off and Quit, in the order asked.
 * Turning on, turning off and Quit are numbered. What waited for the hub, the store or the keys
 * goes on only while nothing was asked since: a late answer cannot turn remote access on again,
 * store it as on, start it, or put its error over a newer state.
 */
export class RemoteHostSwitchService {
	phase: RemoteHostPhase = 'idle';
	reason: string | null = null;
	private asked = 0;
	constructor(private readonly options: RemoteHostSwitchOptions) {}
	/**
	 * At launch: what is stored as on goes online again; nothing is registered. It replaces no
	 * request, and starts nothing once one was made while the record or its keys were read.
	 */
	async start(): Promise<void> {
		const { record, run } = this.options,
			asked = this.asked;
		if (!record.available()) return;
		const state = await record.load().catch(() => null);
		if (asked !== this.asked || !state?.enabled || !state.origin) return;
		const keys = await importRemoteKeys(state.keys);
		if (asked === this.asked) run(state, keys);
	}
	/** Registers, keeps the registration and goes online. An unreadable stored record rejects. */
	async enable(): Promise<void> {
		const { record, changed } = this.options;
		if (!record.available()) return;
		const latest = this.request(),
			state = (await record.load()) ?? (await remoteHostIdentity());
		if (!latest()) return;
		this.phase = 'registering';
		changed();
		const shown = await this.register(state, latest).then(() => quiet, refused);
		if (latest()) [this.phase, this.reason] = shown;
	}
	/** Off takes its turn in the record whatever is asked next, so it is never lost. */
	async disable(): Promise<void> {
		this.request();
		this.options.close();
		[this.phase, this.reason] = quiet;
		await this.options.record.off();
	}
	/** Quit changes no toggle. A record that is being written lands first; nothing starts later. */
	async stop(): Promise<void> {
		this.request();
		this.options.close();
		if (this.phase === 'registering') this.phase = 'idle';
		await this.options.record.settled();
	}
	/** A new request. After a wait, its answer tells whether it is still the latest one. */
	private request(): () => boolean {
		const mine = ++this.asked;
		return () => mine === this.asked;
	}
	/**
	 * Registers on a copy, then keeps and runs the registration: each only while this is still
	 * the latest request. The record is not touched by a registration that answers too late.
	 */
	private async register(state: RemoteHostState, latest: () => boolean): Promise<void> {
		const { record, register, name, run } = this.options,
			draft = { ...state },
			keys = await registerRemoteHost(draft, name(), register),
			{ enabled, origin, generation } = draft;
		const kept = await record.enrol(state, { enabled, origin, generation }, latest);
		if (kept && latest()) run(state, keys);
	}
}
