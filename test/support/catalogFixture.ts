import { historyIndexSchema, indexedRevisionSchema } from '../../src/core/historyIndexTypes';
import { componentManifestSchema } from '../../src/core/unitTypes';
import { revisionRegistry } from '../../src/utils/revisionRegistry';

export const firstCommit = 'a'.repeat(40);
export const secondCommit = 'b'.repeat(40);

function unit(id: string, dependencies: string[] = []) {
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id,
		kind: id.split('.')[0],
		title: id,
		responsibility: `Owns ${id}`,
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [`src/${id}.ts`], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: dependencies.map((target) => ({
			unit: target,
			via: 'import',
			origin: 'declared'
		})),
		runtime: {
			kind: 'module',
			entry: `src/${id}.ts`,
			targets: [{ kind: 'module', entry: `src/${id}.ts` }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	});
}

function revision(commit: string, day: string) {
	return indexedRevisionSchema.parse({
		commit,
		tree: commit,
		parents: [],
		subject: `feat: ${day}`,
		author: 'Fixture',
		authoredAt: `2026-10-${day}T12:00:00Z`,
		committedAt: `2026-10-${day}T12:00:00Z`,
		branches: ['main'],
		retained: false,
		coverage: 'unverified',
		gaps: ['no evidence'],
		records: [],
		reasons: 0,
		legacy: [],
		detail: `revisions/${commit}.json`
	});
}

export function catalogFixture() {
	const model = unit('model.post');
	const service = unit('service.posts', [model.id]);
	const old = revisionRegistry([model, service], []);
	const current = revisionRegistry([model, { ...service, responsibility: 'Queries posts' }], []);
	const index = historyIndexSchema.parse({
		schemaVersion: 1,
		refs: { evidence: null, notes: null },
		branches: [{ name: 'main', head: secondCommit }],
		revisions: [revision(secondCommit, '20'), revision(firstCommit, '19')],
		units: [],
		benchmarks: [],
		profiles: [],
		legacy: [],
		truncated: false,
		problems: []
	});
	return {
		index,
		snapshots: [
			{ commit: firstCommit, registry: old },
			{ commit: secondCommit, registry: current }
		]
	};
}
