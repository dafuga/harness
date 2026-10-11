import type { AgentRunner } from '../models/AgentRunner.types';
import type { ProviderId } from '../models/Desktop.types';
import { validateModel } from '../utils/providerModels';
export class ProviderDiscoveryService {
	constructor(private runners: Record<ProviderId, AgentRunner>) {}
	async list() {
		return Promise.all(Object.values(this.runners).map((runner) => runner.discover()));
	}
	async select(provider: ProviderId, model: string, effort: string | null) {
		const runner = this.runners[provider],
			state = await runner.discover();
		if (!state.available) throw new Error(state.reason ?? 'CLI unavailable.');
		validateModel(state.models, model, effort);
		return runner;
	}
}
