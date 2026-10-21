import type { ExplorerSide } from '../../../reports/src/models/Explorer.types';
import type { EntityEvidenceResult } from '../../src/models/DesktopEvidence.types';
type Mode = 'current' | 'commit';

/** What binds one request for bytes: every field the bridge is given, in one fixed order. */
export const bindingFields = [
	'entityId',
	'mode',
	'commit',
	'branch',
	'side',
	'recordId',
	'scenarioId',
	'state',
	'evidenceId',
	'viewport',
	'sha256',
	'notesRevision',
	'evidenceRevision'
] as const;
export const bindingKey = (query: Record<string, unknown>) =>
	bindingFields.map((name) => query[name] ?? '').join('|');

/** Every capture an answer lists, by the binding a request for its bytes has to state. */
export function bound(result: EntityEvidenceResult, mode: Mode, unit: string, branch: string) {
	const { scope, identity: pin, evidence } = result;
	const sides: Array<['before' | 'after', ExplorerSide | null]> = [
		['before', evidence.before],
		['after', evidence.after]
	];
	return sides.flatMap(([side, held]) =>
		(held?.captures ?? []).map((found) => {
			const { capture } = found;
			const key = bindingKey({
				entityId: unit,
				mode,
				commit: scope.commit,
				branch,
				side,
				recordId: held?.record?.id,
				scenarioId: found.scenario,
				state: found.state,
				evidenceId: capture.evidence,
				viewport: capture.viewport,
				sha256: capture.sha256,
				notesRevision: pin.notesRevision,
				evidenceRevision: pin.evidenceRevision
			});
			return [key, capture.sha256] as const;
		})
	);
}
