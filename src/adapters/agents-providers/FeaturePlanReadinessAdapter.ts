import type { FeaturePlanReadinessAdapterConfig } from './FeaturePlanReadinessAdapter.types';

export class FeaturePlanReadinessAdapter {
	constructor(private readonly config: FeaturePlanReadinessAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'feature-plan-readiness';
	}
}

export type { FeaturePlanReadinessAdapterConfig } from './FeaturePlanReadinessAdapter.types';
