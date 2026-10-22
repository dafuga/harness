import type {
	EntityEvidenceQuery,
	EntityEvidenceResult
} from '../../models/verification-evidence/DesktopEvidence.types';
import { hostedEvidenceSchema } from '../../utils/verification-evidence/hostedEvidenceSchema';

const unaccepted = 'This app does not accept the hosted evidence answer.';

/** Each fact of an answer beside what was asked for: every pair has to be the same. */
function bound(
	answer: EntityEvidenceResult,
	query: EntityEvidenceQuery
): Array<[unknown, unknown]> {
	const { scope, identity, evidence, behavior } = answer;
	return [
		[scope.commit, query.commit],
		[scope.mode, query.mode],
		[scope.branch, query.branch],
		[scope.location.entity, query.entityId],
		[scope.location.branch, query.branch],
		[identity.requestedRef, query.branch],
		[identity.projectId, query.projectId],
		[identity.sourceCommit, query.commit],
		[evidence.mode, query.mode],
		[evidence.after.commit, query.commit],
		[behavior.mode, query.mode]
	];
}

/** At a branch tip there is one side, and that tip is the commit that was asked for. */
function tipAlone({ scope, evidence }: EntityEvidenceResult, query: EntityEvidenceQuery) {
	return evidence.before === null && scope.atTip && scope.tip === query.commit;
}

/** A before side, where there is one, is the first parent of the shown commit. */
function parentBefore({ scope, evidence }: EntityEvidenceResult) {
	return !evidence.before || evidence.before.commit === scope.parent;
}

/** Checks data shape and binding; original sealed-record validation belongs to the server. */
export class HostedEvidenceValidator {
	evidence(value: unknown, query: EntityEvidenceQuery): EntityEvidenceResult {
		const parsed = hostedEvidenceSchema.safeParse(value);
		if (!parsed.success) throw new Error(unaccepted);
		const answer = value as EntityEvidenceResult;
		if (bound(answer, query).some(([found, asked]) => found !== asked))
			throw new Error('The hosted answer is of another evidence read.');
		const current = query.mode === 'current';
		if ((current && !tipAlone(answer, query)) || !parentBefore(answer)) throw new Error(unaccepted);
		return answer;
	}
}
