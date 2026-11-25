// @harness-uid u_hixn27hjr2
import type { QuotaCodexAdapterConfig } from './QuotaCodexAdapter.types';

export class QuotaCodexAdapter {
	constructor(private readonly config: QuotaCodexAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'quota-codex';
	}
}

export type { QuotaCodexAdapterConfig } from './QuotaCodexAdapter.types';
