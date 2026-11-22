export const unitId = 'workflow.run-budget';

export const runtimePath = 'src/workflows/run-budget/runBudget.ts';

export const manifest = {
	schemaVersion: 1,
	id: unitId,
	kind: 'workflow',
	title: 'runBudget',
	responsibility: 'Reports measurements, limits and ledger history, and benchmarks a unit.',
	responsibilityOrigin: 'declared',
	status: 'active',
	owns: { source: [runtimePath], symbols: ['invoke'] },
	contract: {
		origin: 'declared',
		inputs: [],
		outputs: [],
		errors: [],
		errorStatus: 'none-found',
		operations: []
	},
	dependencies: [],
	runtime: {
		kind: 'module',
		entry: runtimePath,
		handler: 'invoke',
		targets: [{ kind: 'module', entry: runtimePath, handler: 'invoke' }]
	},
	scenarios: [],
	budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
};
