import type { CacheIdentity } from '../../../../collaboration/src/models/Collaboration.types.ts';
import type { ExplorerScope } from '../../../../reports/src/models/Explorer.types.ts';
import { explorerBehavior } from '../../../../reports/src/utils/explorerBehavior';
import {
	explorerEvidence,
	type ExplorerRevisions
} from '../../../../reports/src/utils/explorerEvidence';
import { remoteLimits } from '../../../../remote/src/index';
import type { EntityEvidenceResult } from '../../models/DesktopEvidence.types.ts';
import { recordedProjection } from './recordedProjection';

export interface AnswerInput {
	/** Where the read is in history, with the entity it is of. */
	scope: ExplorerScope;
	/** What the revisions were read at. */
	identity: CacheIdentity;
	/** The stored revision of the shown commit, and of its first parent where one is compared. */
	revisions: ExplorerRevisions;
}

/** Room for what a transport wraps around an answer, so both stay within one message. */
const envelope = 1024;

const tooLarge = 'The recorded evidence of this entity is larger than one answer may be (16 MiB).';

/**
 * The answer of an evidence read, from revisions that were already read and validated in full:
 * the evidence of the entity of the scope and its behaviour, as the reports explorer derives
 * them, projected to what that entity needs. An answer that would not fit one message of any
 * transport is refused in words and never cut short.
 */
export function recordedAnswer(input: AnswerInput): EntityEvidenceResult {
	const { scope, identity, revisions } = input;
	const id = scope.location.entity ?? '';
	const whole = explorerEvidence(scope, revisions, { id });
	const answer = {
		scope,
		identity,
		evidence: recordedProjection(whole, id),
		behavior: explorerBehavior(whole)
	};
	const most = remoteLimits.messageBytes - envelope;
	const text = JSON.stringify(answer);
	// One character is at most three bytes of UTF-8: only a long text is measured exactly.
	const size = text.length * 3 > most ? new TextEncoder().encode(text).length : text.length;
	if (size > most) throw new Error(tooLarge);
	return answer;
}
