// @harness-uid u_2gqbg52t3o
import type { PrivateBrowserAgentAdapterConfig } from './PrivateBrowserAgentAdapter.types';

export class PrivateBrowserAgentAdapter {
	constructor(private readonly config: PrivateBrowserAgentAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'private-browser-agent';
	}
}

export type { PrivateBrowserAgentAdapterConfig } from './PrivateBrowserAgentAdapter.types';
