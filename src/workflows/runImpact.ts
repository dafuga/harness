import { resolve } from 'node:path';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import { WorkingTreeAdapter } from '../adapters/WorkingTreeAdapter';
import { fail } from '../core/errors';
import type { ImpactReport, ImpactSide } from '../core/impactTypes';
import type { SourceTree } from '../core/sourceTypes';
import { runtimeKinds, type RuntimeKind } from '../core/unitTypes';
import { ImpactService } from '../services/ImpactService';
import { SourceIndexService } from '../services/SourceIndexService';
import { UnitRuntimeService } from '../services/UnitRuntimeService';
import { graphOf, loadUnits } from './loadUnits';

export interface ImpactOptions {
	root?: string;
	/** Revision to compare from; defaults to `HEAD`. */
	base?: string;
	/** Revision to compare to; defaults to the working tree. */
	head?: string;
	runtime?: string;
}

/** Compares two revisions of this repository and reports what the change affects. */
export async function runImpact(options: ImpactOptions = {}): Promise<ImpactReport> {
	const root = resolve(options.root ?? process.cwd());
	if (!(await new GitAdapter(root).isRepository())) {
		return fail('harness impact compares Git revisions; run it inside a repository.');
	}
	const indexer = new SourceIndexService();
	const base = await side(
		root,
		await CommitTreeAdapter.open(root, options.base ?? 'HEAD'),
		indexer
	);
	const headTree = options.head
		? await CommitTreeAdapter.open(root, options.head)
		: new WorkingTreeAdapter(root);
	const head = await side(root, headTree, indexer);
	const runtime = new UnitRuntimeService(root).kernel(runtimeKind(options.runtime));
	try {
		return await new ImpactService(runtime).compute(base, head);
	} finally {
		await runtime.close();
	}
}

/** Uses the reconciled registry so files a stale manifest misses are still owned. */
async function side(
	root: string,
	tree: SourceTree,
	indexer: SourceIndexService
): Promise<ImpactSide> {
	const loaded = await loadUnits(root, tree, indexer);
	return {
		revision: tree.revision,
		config: loaded.config,
		entries: await tree.list(),
		manifests: loaded.fresh.manifests,
		scenarios: loaded.scenarios,
		graph: graphOf(loaded, loaded.fresh.manifests)
	};
}

function runtimeKind(value: string | undefined): RuntimeKind | 'default' {
	if (value === undefined || value === 'default') return 'default';
	const kind = runtimeKinds.find((item) => item === value);
	return (
		kind ?? fail(`Unknown runtime "${value}". Use one of: default, ${runtimeKinds.join(', ')}.`)
	);
}

export function renderImpact(report: ImpactReport): string {
	const { units, tests, scenarios } = report;
	const total = tests.selected.length + tests.excluded.length;
	const known = scenarios.affected.length + scenarios.unaffected.length;
	return [
		`Impact of ${report.head} against ${report.base} using the ${report.runtime} runtime.`,
		`Changed: ${report.changed.length} files.`,
		`Units: ${units.direct.length} direct, ${units.indirect.length} indirect, ` +
			`${units.added.length} added, ${units.removed.length} removed.`,
		`Tests: ${tests.selected.length} of ${total} tests selected.`,
		...tests.selected.map((path) => `  ${path}`),
		`Scenarios: ${scenarios.affected.length} of ${known} affected.`,
		...scenarios.affected.map((id) => `  ${id}`),
		...(report.expanded ? ['Selection was widened to every test:'] : []),
		...report.uncertain.map((entry) => `  ${entry.reason}: ${entry.node} (${entry.detail})`)
	].join('\n');
}
