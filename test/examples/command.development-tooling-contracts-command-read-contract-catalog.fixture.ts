import { contractUnit } from '../support/contractsProject';

export const zeta = {
	...contractUnit('function.zeta', 'src/core/zeta.ts'),
	owns: { source: [], symbols: [] }
};

export const flow = {
	schemaVersion: 1,
	id: 'flow',
	title: 'Alpha flow',
	kind: 'headless',
	units: ['command.alpha', 'function.beta'],
	states: [
		{ id: 'shared', title: 'Both units', coverage: 'required' },
		{ id: 'beta-only', title: 'Beta only', coverage: 'required', units: ['function.beta'] }
	],
	viewports: [],
	tests: [{ id: 'examples', kind: 'unit', runner: 'vitest', target: 'test/alpha.test.ts' }],
	evidence: []
};
