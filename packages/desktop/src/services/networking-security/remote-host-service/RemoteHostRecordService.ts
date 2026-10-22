import type {
	RemoteHostState,
	RemoteHostStoreAdapter
} from '../../../adapters/networking-security/RemoteHostStoreAdapter';

/** What a registration changes in the record. */
export type RemoteHostEnrolment = Pick<RemoteHostState, 'enabled' | 'origin' | 'generation'>;

/**
 * The one copy of what this computer keeps for remote access. It is read once, however many ask.
 * Every change takes its turn: changes are applied and written in the order they were asked for,
 * each write with the record as it is then, so what was asked last is what stays stored.
 */
export class RemoteHostRecordService {
	/** The record in memory: what was read, or what a registration made it. */
	value: RemoteHostState | null = null;
	private reading: Promise<RemoteHostState | null> | null = null;
	private turn: Promise<unknown> = Promise.resolve();
	constructor(private readonly store: RemoteHostStoreAdapter) {}
	available(): boolean {
		return this.store.available();
	}
	/** The record in memory, else what is stored. A read that failed is tried again. */
	load(): Promise<RemoteHostState | null> {
		if (this.value) return Promise.resolve(this.value);
		this.reading ??= this.read();
		return this.reading;
	}
	/** In its turn: the record is written as it is then. Without a record nothing is written. */
	save(): Promise<void> {
		return this.inTurn(async () => {
			if (this.value) await this.store.save(this.value);
		});
	}
	/**
	 * Remote access is off: at once where the record is known, and again in its turn, after
	 * everything asked before, so that nothing asked earlier can leave it stored as on.
	 */
	off(): Promise<void> {
		if (this.value) this.value.enabled = false;
		return this.inTurn(async () => {
			const state = await this.load().catch(() => null);
			if (!state) return;
			state.enabled = false;
			await this.store.save(state);
		});
	}
	/**
	 * In its turn: `state` becomes the record as `registered` says, and is written. Nothing is
	 * changed once `wanted()` is false. A write that fails takes the registration back, and
	 * never turns on what was turned off meanwhile.
	 */
	enrol(
		state: RemoteHostState,
		registered: RemoteHostEnrolment,
		wanted: () => boolean
	): Promise<boolean> {
		return this.inTurn(async () => {
			if (!wanted()) return false;
			const earlier = this.value,
				{ enabled, origin, generation } = state;
			this.value = Object.assign(state, registered);
			await this.store.save(state).catch((error: unknown) => {
				Object.assign(state, { enabled: state.enabled && enabled, origin, generation });
				this.value = earlier;
				throw error;
			});
			return true;
		});
	}
	/** Resolves once everything asked so far has ended, however it ended. */
	async settled(): Promise<void> {
		await this.turn;
	}
	private inTurn<T>(work: () => Promise<T>): Promise<T> {
		const done = this.turn.then(work);
		this.turn = done.catch(() => undefined);
		return done;
	}
	private async read(): Promise<RemoteHostState | null> {
		try {
			const stored = await this.store.read();
			this.value ??= stored;
			return this.value;
		} catch (error) {
			this.reading = null;
			throw error;
		}
	}
}
