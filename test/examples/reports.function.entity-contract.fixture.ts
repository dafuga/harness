import type { HarnessUnit } from '../../packages/reports/src/models/explorer-ui/Harness.types';

export const unit = (
	patch: Partial<HarnessUnit> & Pick<HarnessUnit, 'id' | 'kind' | 'title'>
): HarnessUnit => ({
	status: 'active',
	responsibility: `${patch.title} as described.`,
	dependencies: [],
	scenarios: [],
	owns: { source: [], symbols: [] },
	contract: { inputs: [], outputs: [], errors: [] },
	runtime: { kind: 'module', targets: [] },
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
	version: 'fixture',
	...patch
});

export const field = (name: string, description?: string, type = 'string') => ({
	name,
	type,
	description
});
