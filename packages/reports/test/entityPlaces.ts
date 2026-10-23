import type { View } from './entityPlaces.types';
import { explorerRoutePath } from '../../../src/utils/explorerRoute';
import type { ExplorerLocation, ExplorerScope } from '../src/models/Explorer.types';
import type { HarnessIndex, HarnessRevision } from '../src/models/Harness.types';
import type { EntityLens, EntityNav } from '../src/utils/entityLens';
import { explorerBehavior } from '../src/utils/explorerBehavior';
import { explorerEntities } from '../src/utils/explorerEntities';
import { explorerEvidence } from '../src/utils/explorerEvidence';
import { explorerHistory } from '../src/utils/explorer-history/explorerHistory';
import { explorerRelations } from '../src/utils/explorerRelations';
import { index, record, revision } from './entityFixture';
import { commits } from './entityUnits';

export function placePath(place: ExplorerLocation): string {
	return '/harness' + explorerRoutePath(place);
}

export const place = (changed: Partial<ExplorerLocation> = {}): ExplorerLocation => ({
	branch: 'feature/orders',
	commit: commits.middle,
	category: 'pages',
	...changed
});

/** A nav that records where it was asked to go, for a component rendered on its own. */
export function nav(route: ExplorerLocation = place(), went: ExplorerLocation[] = []): EntityNav {
	return { route, href: placePath, go: (to) => went.push(to) };
}

const summary = (commit: string, parents: string[]) => ({
	commit,
	parents,
	subject: 'feat: case-insensitive search',
	author: 'Fixture',
	committedAt: '2026-10-09T09:00:00.000Z',
	branches: ['feature/orders'],
	retained: false,
	coverage: 'verified' as const,
	gaps: [],
	records: [],
	legacy: []
});

/** The selected commit with its first parent, or the tip of the branch with no parent shown. */
export function scope(mode: 'current' | 'commit', location = place()): ExplorerScope {
	const commit = mode === 'current' ? commits.tip : commits.middle;
	const parent = mode === 'current' ? commits.middle : commits.first;
	return {
		location: { ...location, commit: mode === 'current' ? null : commit },
		mode,
		branch: 'feature/orders',
		tip: commits.tip,
		commit,
		atTip: mode === 'current',
		parent,
		summary: summary(commit, [parent])
	};
}

const parents: Record<string, string | null> = {
	[commits.first]: null,
	[commits.middle]: commits.first,
	[commits.tip]: commits.middle
};
/** The tip alone, or a selected commit beside the first parent the history gives it. */
export function viewOf(route: ExplorerLocation, stored: Record<string, HarnessRevision>): View {
	if (route.commit === null) {
		return { scope: scope('current', route), head: stored[commits.tip], parent: null };
	}
	const parent = parents[route.commit] ?? null;
	const at = { ...scope('commit', route), commit: route.commit, parent };
	return {
		scope: { ...at, atTip: route.commit === commits.tip },
		head: stored[route.commit],
		parent: parent ? stored[parent] : null
	};
}

/** A selected commit beside its recorded parent, or the recorded tip alone. */
export function view(mode: 'current' | 'commit', changed: Partial<View> = {}): View {
	const at = scope(mode);
	const parent = mode === 'commit' ? revision(commits.first, [record(commits.first)]) : null;
	return { scope: at, head: revision(at.commit, [record(at.commit)]), parent, ...changed };
}

/** What the host's helpers say about one unit in a view; the answers the content renders. */
export function answers(shown: View, id: string) {
	const entities = explorerEntities(shown.head);
	const unit = shown.head.registry.units.find((item) => item.id === id)!;
	const evidence = explorerEvidence(shown.scope, shown, unit);
	return {
		entities,
		entity: entities.find((item) => item.id === id)!,
		unit,
		relations: explorerRelations(shown.head, id),
		evidence,
		behavior: explorerBehavior(evidence),
		history: explorerHistory(index, shown.scope, id)
	};
}

/** The lens a host builds for a view, from the same helpers and in the same way. */
export function lens(shown: View, history: HarnessIndex = index): EntityLens {
	const revisions = { head: shown.head, parent: shown.parent };
	return {
		href: placePath,
		relations: (id) => explorerRelations(shown.head, id),
		evidence: (unit) => explorerEvidence(shown.scope, revisions, unit),
		behavior: (unit) => explorerBehavior(explorerEvidence(shown.scope, revisions, unit)),
		history: (id) => explorerHistory(history, shown.scope, id)
	};
}

export type { View } from './entityPlaces.types';
