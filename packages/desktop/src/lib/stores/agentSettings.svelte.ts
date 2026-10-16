import { AgentSettingsAdapter } from '../../adapters/AgentSettingsAdapter';
import { defaultDesignCount, designCounts } from '../../utils/composeModes';

/** One reactive device preference serves project and thread composers alike. */
export function createAgentSettingsStore(
	adapter: Pick<AgentSettingsAdapter, 'read' | 'write'> = new AgentSettingsAdapter()
) {
	let designOptions = $state(defaultDesignCount);
	let saved = $state(true);
	let loaded = false;

	return {
		get designOptions() {
			return designOptions;
		},
		get saved() {
			return saved;
		},
		load() {
			if (loaded) return;
			designOptions = adapter.read();
			loaded = true;
		},
		setDesignOptions(value: number) {
			if (!designCounts.includes(value)) return false;
			designOptions = value;
			saved = adapter.write(value);
			return saved;
		}
	};
}

export const agentSettings = createAgentSettingsStore();
