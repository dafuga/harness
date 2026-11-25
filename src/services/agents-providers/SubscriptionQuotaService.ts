// @harness-uid u_xzwv5okyoc
import { QuotaClaudeAdapter } from '../../adapters/agents-providers/QuotaClaudeAdapter';
import { QuotaCodexAdapter } from '../../adapters/agents-providers/QuotaCodexAdapter';
import { setTimeout as delay } from 'node:timers/promises';
import type { SubscriptionReader, SubscriptionReading } from './SubscriptionQuotaService.types';

const refreshInterval = 5 * 60_000;
const staleAfter = 60 * 60_000;

/** Serves the last successful reading independently for each local subscription. */
export class SubscriptionQuotaService {
	private readonly readings = new Map<string, SubscriptionReading>();
	private readonly readers: readonly SubscriptionReader[];
	private refreshing?: Promise<void>;
	private attemptedAt = -Infinity;

	constructor(readers?: readonly SubscriptionReader[]) {
		const claude = new QuotaClaudeAdapter();
		const codex = new QuotaCodexAdapter();
		this.readers = readers ?? [(now) => claude.read(now), (now) => codex.read(now)];
	}

	/** Concurrent Home requests share a refresh. A failed provider retains its original timestamp. */
	async read(now: number = Date.now(), waitMs?: number): Promise<SubscriptionReading[]> {
		if (!this.refreshing && (now < this.attemptedAt || now - this.attemptedAt >= refreshInterval)) {
			this.attemptedAt = now;
			this.refreshing = this.refresh(now).finally(() => {
				this.refreshing = undefined;
			});
		}
		if (this.refreshing && waitMs !== undefined) {
			await Promise.race([this.refreshing, delay(waitMs, undefined, { ref: false })]);
		} else {
			await this.refreshing;
		}
		return [...this.readings.values()]
			.filter((reading) => {
				const age = now - Date.parse(reading.readAt);
				return age >= 0 && age <= staleAfter;
			})
			.sort((a, b) => a.id.localeCompare(b.id));
	}

	private async refresh(now: number): Promise<void> {
		await Promise.allSettled(
			this.readers.map(async (read) => {
				const reading = await read(now);
				if (reading) this.readings.set(reading.id, reading);
			})
		);
	}
}
