// @harness-uid u_fbp7jjiy5y
import type { AgentRunner } from '../../../models/agents-providers/AgentRunner.types';
import type { ProviderId } from '../../../models/development-tooling/Desktop.types';
import { validateModel } from './providerModels';

export class ProviderDiscoveryService {
	constructor(private runners: Record<ProviderId, AgentRunner>) {}
	async list() {
		return Promise.all(Object.values(this.runners).map((runner) => runner.discover()));
	}
	/** The authoring models serve the workflow independently of the chat model picker. */
	async mockupRunner() {
		const runner = this.runners.claude;
		const state = await runner.discover();
		if (!state.available) throw new Error(state.reason ?? 'Claude CLI is unavailable.');
		return runner;
	}
	async select(provider: ProviderId, model: string, effort: string | null) {
		const runner = this.runners[provider],
			state = await runner.discover();
		if (!state.available) throw new Error(state.reason ?? 'CLI unavailable.');
		validateModel(state.models, model, effort);
		return runner;
	}
}
