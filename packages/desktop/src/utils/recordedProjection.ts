import type { ExplorerEvidence, ExplorerSide } from '../../../reports/src/models/Explorer.types';
import type { HarnessRecord, HarnessRevision } from '../../../reports/src/models/Harness.types';

type Impact = NonNullable<HarnessRevision['sourceImpact']>;
/** The scenarios that cover the entity on one side, each with the states that show it. */
type Shown = Map<string, Set<string>>;
type Staged = { id: string; states: Array<{ id: string }> };

const shownOn = (side: ExplorerSide): Shown =>
	new Map(
		side.coverage.map((item) => [item.scenario, new Set(item.states.map((state) => state.state))])
	);

/** The scenarios that cover the entity, each with only the states that show it. */
function covering<Item extends Staged>(items: Item[], shown: Shown): Item[] {
	return items
		.filter((item) => shown.has(item.id))
		.map((item) => ({
			...item,
			states: item.states.filter((state) => shown.get(item.id)?.has(state.id))
		}));
}

/** What a commit changed, said of this entity alone. */
function units(whole: Impact['units'], entity: string): Impact['units'] {
	const own = (ids: string[]) => ids.filter((id) => id === entity);
	return {
		direct: own(whole.direct),
		indirect: own(whole.indirect),
		added: own(whole.added),
		removed: own(whole.removed)
	};
}

/** A record with what judges this entity: every test, and of the rest only what is its own. */
function record(whole: HarnessRecord, entity: string, shown: Shown): HarnessRecord {
	const { id, status, valid, problems, source, profile, startedAt, finishedAt } = whole;
	return {
		...{ id, status, valid, problems, source, profile, startedAt, finishedAt },
		...(whole.gates ? { gates: whole.gates } : {}),
		failures: whole.failures.filter((failure) => failure.startsWith(`${entity}: `)),
		// The record does not say which unit a test file covers, so no test is left out.
		tests: whole.tests,
		scenarios: covering(whole.scenarios, shown),
		measurements: whole.measurements.filter((made) => made.unit === entity),
		budgets: { findings: whole.budgets.findings.filter((found) => found.unit === entity) }
	};
}

function detail(whole: HarnessRevision, entity: string, shown: Shown): HarnessRevision {
	const { registry, comparison, sourceImpact } = whole;
	const proofs = (whole.regressions ?? []).filter(
		(proof) => !proof.units.length || proof.units.includes(entity)
	);
	const ran = (ids: string[]) => ids.filter((id) => shown.has(id));
	const impact = (stated: Pick<Impact, 'base' | 'units' | 'scenarios'>) => ({
		base: stated.base,
		units: units(stated.units, entity),
		scenarios: ran(stated.scenarios),
		uncertain: []
	});
	const changed = sourceImpact && { ...impact(sourceImpact), expanded: sourceImpact.expanded };
	return {
		commit: whole.commit,
		registry: {
			available: registry.available,
			...(registry.gap === undefined ? {} : { gap: registry.gap }),
			units: registry.units.filter((unit) => unit.id === entity),
			scenarios: covering(registry.scenarios, shown),
			graph: { edges: [] }
		},
		comparison: comparison && { ...impact(comparison), record: comparison.record },
		...(changed === undefined ? {} : { sourceImpact: changed && { ...changed, changed: [] } }),
		records: whole.records.map((item) => record(item, entity, shown)),
		explanations: whole.explanations.filter((reason) => reason.unit === entity),
		...(proofs.length ? { regressions: proofs } : {})
	};
}

function side(whole: ExplorerSide, entity: string): ExplorerSide {
	if (!whole.detail) return whole;
	const projected = detail(whole.detail, entity, shownOn(whole));
	const judged = projected.records.find((item) => item.id === whole.record?.id) ?? null;
	return { ...whole, detail: projected, record: judged };
}

/**
 * The evidence of one entity with only what that entity needs. Each side keeps its captures and
 * coverage as they were found, and of its revision and records what judges this entity: its own
 * unit, the scenarios that cover it with the states that show it, every test, and its own
 * failures, measurements, limits, impact and reasons. Other units, the graph, the files a
 * commit changed and the results of other scenarios are left out. The evidence that is given is
 * not altered, and the projection still derives the same evidence and the same verdict.
 */
export function recordedProjection(evidence: ExplorerEvidence, entityId: string): ExplorerEvidence {
	return {
		...evidence,
		after: side(evidence.after, entityId),
		before: evidence.before && side(evidence.before, entityId)
	};
}
