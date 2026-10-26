import { expect } from 'vitest';
import { FeaturePlanCoverageValidator } from '../../../src/validators/agents-providers/FeaturePlanCoverageValidator';
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

function scopedGraph() {
	const metadata = data();
	metadata.registry.units.push(unit('script.unrelated', 'script'));
	metadata.relationships['script.unrelated'] = relationships();
	metadata.relationships['component.shared'].pages = ['page.alpha'];
	const node = (id: string, kind: string, owner?: string) => ({
		id,
		kind,
		...(owner ? { unit: owner } : {})
	});
	const nodes = metadata.registry.units.flatMap((item) => [
		node(`unit:${item.id}`, 'unit', item.id),
		node(`file:${item.owns.source[0]}`, 'source', item.id)
	]);
	nodes.push(node('file:test/unrelated.test.ts', 'test'), node('scenario:coverage', 'scenario'));
	const edges = metadata.registry.units.map((item) => ({
		from: `unit:${item.id}`,
		to: `file:${item.owns.source[0]}`,
		via: 'owns'
	}));
	edges.push(
		{
			from: 'file:src/routes/page.alpha/+page.svelte',
			to: 'file:src/component.shared.ts',
			via: 'import'
		},
		{ from: 'file:src/component.shared.ts', to: 'file:src/component.other.ts', via: 'import' },
		{ from: 'scenario:coverage', to: 'unit:page.alpha', via: 'covers' },
		{ from: 'scenario:coverage', to: 'file:test/unrelated.test.ts', via: 'proves' }
	);
	return { ...metadata, sourceGraph: { nodes, edges, uncertain: [] } };
}

function referenceNode(kind: string) {
	if (['script', 'forward-only', 'inactive-consumer'].includes(kind))
		return 'file:src/script.unrelated.ts';
	return (
		new Map([
			['transitive', 'file:src/component.other.ts'],
			['page', 'file:src/routes/page.alpha/+page.svelte'],
			['missing-node', 'file:src/missing.ts'],
			['unowned', 'file:src/orphan.ts']
		]).get(kind) ?? 'file:test/unrelated.test.ts'
	);
}

function scopedReference(kind: string) {
	const metadata = scopedGraph();
	const benign = ['test', 'script', 'forward-only', 'inactive-consumer'].includes(kind);
	const node = referenceNode(kind);
	if (kind === 'forward-only')
		metadata.sourceGraph.edges.push({ from: node, to: 'unit:page.alpha', via: 'import' });
	if (kind === 'inactive-consumer') {
		metadata.registry.units.push(unit('page.inactive', 'page', 'inactive'));
		metadata.sourceGraph.nodes.push({
			id: 'unit:page.inactive',
			kind: 'unit',
			unit: 'page.inactive'
		});
		metadata.sourceGraph.edges.push({ from: 'unit:page.inactive', to: node, via: 'import' });
	}
	if (kind === 'dangling')
		metadata.sourceGraph.edges.push({ from: 'file:src/missing.ts', to: node, via: 'import' });
	if (kind === 'ambiguous')
		metadata.sourceGraph.nodes.push({ id: node, kind: 'source', unit: 'page.alpha' });
	if (kind === 'unowned') {
		metadata.sourceGraph.nodes.push({ id: node, kind: 'source' });
	}
	if (kind === 'absent-graph') metadata.sourceGraph.nodes = [];
	const reference = { node, reason: 'unresolved-import', detail: `missing-${kind}-target` };
	metadata.references = [reference, reference];
	return { metadata, reference, benign };
}

export function assertScopedUncertainty() {
	const validator = new FeaturePlanCoverageValidator();
	for (const kind of [
		'test',
		'script',
		'forward-only',
		'inactive-consumer',
		'transitive',
		'page',
		'missing-node',
		'dangling',
		'ambiguous',
		'unowned',
		'absent-graph'
	]) {
		const { metadata, reference, benign } = scopedReference(kind);
		const input = plan([change('component.shared')], ['page.alpha']);
		const before = structuredClone({ input, metadata });
		const result = validator.validate(input as never, metadata as never);
		const impact = { sourceCommit: input.sourceCommit, changes: input.changes };
		expect(validator.discover(impact as never, metadata as never), kind).toEqual({
			valid: benign,
			affectedPages: ['page.alpha'],
			errors: result.errors
		});
		expect(result.valid, kind).toBe(benign);
		expect(result.affectedPages, kind).toEqual(['page.alpha']);
		expect(result.missingPages, kind).toEqual([]);
		if (benign) expect(result.errors, kind).toEqual([]);
		else {
			const diagnostic = result.errors.filter((error) =>
				Object.values(reference).every((field) => error.includes(field))
			);
			expect(diagnostic, kind).toHaveLength(1);
		}
		expect({ input, metadata }, kind).toEqual(before);
	}
}
