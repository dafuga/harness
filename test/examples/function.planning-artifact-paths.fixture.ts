export const gridFolder = 'src/components/evidence-grid';

export const contract = {
	responsibility: 'Describes one unit and the planning artifacts it owns.',
	inputs: [],
	outputs: [],
	errors: [],
	states: [],
	viewports: []
};

const gridEntry = `${gridFolder}/index.ts`;

export const gridManifest = {
	schemaVersion: 1,
	id: 'reports.component.evidence-grid',
	kind: 'component',
	title: 'Evidence grid',
	responsibility: contract.responsibility,
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: [gridEntry], symbols: ['EvidenceGrid'] },
	contract: { origin: 'declared', inputs: [], outputs: [], errors: [], errorStatus: 'none-found' },
	dependencies: [],
	runtime: { kind: 'module', entry: gridEntry, targets: [{ kind: 'module', entry: gridEntry }] },
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};
