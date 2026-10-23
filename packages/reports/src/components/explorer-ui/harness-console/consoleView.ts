import type { ViewInput } from './consoleView.types';
import type { ExplorerEntity, ExplorerLocation } from '../../../models/Explorer.types';
import type { HarnessRevision, HarnessUnit } from '../../../models/Harness.types';
import type { EntityLens } from '../../../utils/entityLens';
import { correctedLocation } from '../../../utils/correctedLocation';
import { explorerBehavior } from '../../../utils/explorerBehavior';
import { explorerEvidence } from '../../../utils/explorerEvidence';
import { explorerHistory } from '../../../utils/explorer-history/explorerHistory';
import { explorerRelationsReader } from '../../../utils/explorerRelations';

/** Remount content when its exact selected route changes, including callable and tab identity. */
export function consoleContentKey(location: ExplorerLocation | undefined): string {
	return JSON.stringify([
		location?.branch,
		location?.commit,
		location?.category,
		location?.screen,
		location?.entity,
		location?.helper,
		location?.section
	]);
}

/** What an entity relates to at a revision; what its commit removed, as the parent held it. */
export function consoleRelations(
	detail: HarnessRevision,
	before: HarnessRevision | null,
	listed: ExplorerEntity[]
) {
	const own = explorerRelationsReader(detail, listed);
	// The parent lists its own entities, with the verdicts it gave them.
	const last = before ? explorerRelationsReader(before) : own;
	const held = new Set(detail.registry.units.map((unit) => unit.id));
	return (id: string) => (held.has(id) ? own : last)(id);
}
/** Bind one revision's helper identity and cached answers to the screen it renders. */
export function consoleView({
	index,
	scope,
	loaded,
	entities,
	relations,
	answers,
	href
}: ViewInput) {
	const location = correctedLocation(scope.location, entities) ?? scope.location;
	const at = { ...scope, location };
	const [history, revisions, known] = [index, loaded, answers];
	const answer = (unit: HarnessUnit) => {
		const found = known.get(unit.id);
		if (found) return found;
		const evidence = explorerEvidence(at, revisions, unit);
		const made = { evidence, behavior: explorerBehavior(evidence) };
		known.set(unit.id, made);
		return made;
	};
	const lens: EntityLens = {
		href,
		relations,
		evidence: (unit) => answer(unit).evidence,
		behavior: (unit) => answer(unit).behavior,
		history: (id) => explorerHistory(history, at, id)
	};
	return { index: history, scope: at, head: revisions.head, parent: revisions.parent, lens };
}

export type { ConsoleAnswer } from './consoleView.types';
