// @harness-uid u_adhudyj52u
import type {
	EntityEvidenceQuery,
	EvidenceArtifactQuery
} from '../../models/verification-evidence/DesktopEvidence.types';
import {
	commitPattern,
	enumField,
	hashPattern,
	idPattern,
	nullableText,
	textField
} from '../ipc-payload/ipcFields';

const modes = ['current', 'commit'] as const;
const sides = ['before', 'after'] as const;
const pinned = (value: unknown): string | null => nullableText(value, commitPattern);

/**
 * The fields of an evidence or artifact read, and nothing else: whatever else a caller sends,
 * such as a path or an address, is dropped. A capture is named only by its binding.
 */
export function evidencePayload(channel: string, x: object) {
	const scopeInput = x as EntityEvidenceQuery;
	const scope = {
		entityId: textField(scopeInput.entityId, 120, idPattern),
		commit: textField(scopeInput.commit, 40, commitPattern),
		branch: textField(scopeInput.branch, 255),
		mode: enumField(scopeInput.mode, modes)
	};
	if (channel !== 'evidence:artifact') return scope;
	const artifactInput = x as EvidenceArtifactQuery;
	return {
		...scope,
		side: enumField(artifactInput.side, sides),
		recordId: textField(artifactInput.recordId, 64, hashPattern),
		scenarioId: textField(artifactInput.scenarioId, 120, idPattern),
		state: textField(artifactInput.state, 120, idPattern),
		evidenceId: textField(artifactInput.evidenceId, 120, idPattern),
		viewport: nullableText(artifactInput.viewport, idPattern),
		sha256: textField(artifactInput.sha256, 64, hashPattern),
		notesRevision: pinned(artifactInput.notesRevision),
		evidenceRevision: pinned(artifactInput.evidenceRevision)
	};
}
