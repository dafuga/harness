export function unitManifest(id: string, kind: string, path: string) {
	return {
		schemaVersion: 1,
		id,
		kind,
		title: id,
		responsibility: 'Fixture responsibility',
		responsibilityOrigin: 'declared',
		runtime: { kind: 'module', entry: path, targets: [{ kind: 'module', entry: path }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		status: 'active',
		owns: { source: [path], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		...(id === 'function.filter'
			? {
					helperContracts: [
						{
							name: 'filter',
							source: path,
							pure: true,
							inputs: [{ name: 'filter.input', type: 'string' }],
							output: 'string',
							consumers: [
								{ unit: 'page.home', symbol: 'owned' },
								{ unit: 'service.analytics', symbol: 'owned' }
							]
						}
					]
				}
			: {}),
		dependencies: ['page.home', 'service.analytics'].includes(id)
			? [{ unit: 'function.filter', via: 'import', origin: 'declared' }]
			: []
	};
}
