import { defaultDesignCount, designCounts } from '../utils/composeModes';

export interface AgentSettingsAdapterConfig {
	storage?: Pick<Storage, 'getItem' | 'setItem'>;
}

/** Device preferences are kept apart from project history and agent credentials. */
export class AgentSettingsAdapter {
	constructor(private readonly config: AgentSettingsAdapterConfig = {}) {}

	read(): number {
		try {
			const raw = this.storage?.getItem('harness.agent-settings.v1');
			const value = raw
				? (JSON.parse(raw) as { designOptions?: unknown } | null)?.designOptions
				: null;
			return typeof value === 'number' && designCounts.includes(value) ? value : defaultDesignCount;
		} catch {
			return defaultDesignCount;
		}
	}

	write(designOptions: number): boolean {
		if (!designCounts.includes(designOptions)) return false;
		try {
			if (!this.storage) return false;
			this.storage.setItem('harness.agent-settings.v1', JSON.stringify({ designOptions }));
			return true;
		} catch {
			return false;
		}
	}

	private get storage() {
		return this.config.storage ?? globalThis.localStorage;
	}
}
