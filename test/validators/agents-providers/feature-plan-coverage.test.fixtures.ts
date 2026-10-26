const sourceCommit = 'a'.repeat(40);
const contract = { inputs: [], outputs: [], errors: [] };
export function unit(id: string, kind = 'component', status = 'active') {
	const file = kind === 'page' ? `src/routes/${id}/+page.svelte` : `src/${id}.ts`;
	return {
		id,
		kind,
		status,
		title: id,
		responsibility: id,
		dependencies: [],
		scenarios: [],
		owns: { source: [file], symbols: [] },
		contract,
		runtime: { kind: 'module', targets: [] },
		budgets: {},
		version: 'a'.repeat(16)
	};
}
export function relationships(pages: string[] = []) {
	return {
		pages,
		layouts: [],
		components: [],
		functions: [],
		configs: [],
		services: [],
		types: [],
		apis: [],
		models: [],
		usedBy: [],
		support: []
	};
}
export function data() {
	const units = [
		unit('component.shared'),
		unit('component.other'),
		unit('page.alpha', 'page'),
		unit('page.beta', 'page'),
		unit('page.direct', 'page')
	];
	return {
		schemaVersion: 1,
		producer: 'test',
		commit: sourceCommit,
		tree: sourceCommit,
		digest: 'b'.repeat(64),
		inputs: { notes: null, evidence: null },
		declarations: [],
		versions: {},
		sourceGraph: { nodes: [], edges: [], uncertain: [] },
		sourceIssues: [],
		references: [] as unknown[],
		modules: [],
		issues: [],
		registry: { available: true, units, scenarios: [], graph: { nodes: [], edges: [] } },
		relationships: Object.fromEntries(units.map((item) => [item.id, relationships()]))
	};
}
export function change(
	id: string,
	kind: 'modify' | 'reuse' | 'add' | 'remove' = 'modify',
	parent?: string
) {
	return {
		unit: id,
		kind,
		...(parent ? { parent } : {}),
		wantedContract: contract,
		assignedFiles: [`src/${id}.ts`]
	};
}
export function plan(changes = [change('component.shared')], pages: string[] = []) {
	return {
		feature: 'coverage',
		sourceCommit,
		revision: 1,
		goal: 'Cover affected pages',
		tldr: 'Review each affected page',
		digest: 'c'.repeat(64),
		changes,
		tasks: [],
		pages: pages.map((module) => ({
			module,
			options: [
				{
					id: 'option-a',
					version: 'v1',
					commit: sourceCommit,
					path: 'design.png',
					sha256: 'd'.repeat(64),
					preferred: true
				}
			]
		}))
	};
}
