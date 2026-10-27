import { expect } from 'vitest';
import { FeaturePlanCoverageValidator } from '../../../src/validators/agents-providers/FeaturePlanCoverageValidator';
import { unit, relationships, data, change, plan } from './feature-plan-coverage-base.fixtures';
export { unit, relationships, data, change, plan } from './feature-plan-coverage-base.fixtures';

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

function addDanglingCases(metadata: ReturnType<typeof scopedGraph>, kind: string) {
	if (
		[
			'dangling-test',
			'reachable-dangling-test',
			'missing-page-ownership',
			'missing-page-node'
		].includes(kind)
	) {
		metadata.sourceGraph.edges.push({
			from: 'file:test/unrelated.test.ts',
			to: 'file:test/missing-fixture.json',
			via: 'import'
		});
	}
	if (kind === 'reachable-dangling-test')
		metadata.sourceGraph.edges.push({
			from: 'file:src/routes/page.alpha/+page.svelte',
			to: 'file:test/unrelated.test.ts',
			via: 'import'
		});
	if (kind === 'dangling-scenario')
		metadata.sourceGraph.edges.push({
			from: 'scenario:coverage',
			to: 'unit:retired.module',
			via: 'covers'
		});
	if (kind === 'page-dangling')
		metadata.sourceGraph.edges.push({
			from: 'file:src/routes/page.alpha/+page.svelte',
			to: 'file:src/missing-page-dependency.ts',
			via: 'import'
		});
}

function removePageAnchor(metadata: ReturnType<typeof scopedGraph>, kind: string) {
	if (kind === 'missing-page-ownership')
		metadata.sourceGraph.edges = metadata.sourceGraph.edges.filter(
			(edge) => !(edge.from === 'unit:page.alpha' && edge.via === 'owns')
		);
	if (kind === 'missing-page-node') {
		metadata.sourceGraph.nodes = metadata.sourceGraph.nodes.filter(
			(node) => node.id !== 'unit:page.alpha'
		);
		metadata.sourceGraph.edges = metadata.sourceGraph.edges.filter(
			(edge) => edge.from !== 'unit:page.alpha' && edge.to !== 'unit:page.alpha'
		);
	}
}

function scopedReference(kind: string) {
	const metadata = scopedGraph();
	const benign = [
		'test',
		'script',
		'forward-only',
		'inactive-consumer',
		'dangling-test',
		'dangling-scenario'
	].includes(kind);
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
	addDanglingCases(metadata, kind);
	removePageAnchor(metadata, kind);
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
		'dangling-test',
		'dangling-scenario',
		'reachable-dangling-test',
		'page-dangling',
		'missing-page-ownership',
		'missing-page-node',
		'ambiguous',
		'unowned',
		'absent-graph'
	]) {
		const { metadata, reference, benign } = scopedReference(kind);
		const input = plan([change('component.shared')], ['page.alpha']);
		const before = structuredClone({ input, metadata });
		const result = validator.validate(input, metadata as never);
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
