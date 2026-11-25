// @harness-uid u_attkdntuyv
import type { QuotaClaudeAdapterConfig } from './QuotaClaudeAdapter.types';

export class QuotaClaudeAdapter {
	constructor(private readonly config: QuotaClaudeAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'quota-claude';
	}
}

export type { QuotaClaudeAdapterConfig } from './QuotaClaudeAdapter.types';
