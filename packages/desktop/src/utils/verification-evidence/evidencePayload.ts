import {
	commitPattern,
	enumField,
	hashPattern,
	idPattern,
	nullableText,
	textField
} from '../development-tooling/ipcFields';

const modes = ['current', 'commit'] as const;
const sides = ['before', 'after'] as const;
const pinned = (value: unknown): string | null => nullableText(value, commitPattern);

/**
 * The fields of an evidence or artifact read, and nothing else: whatever else a caller sends,
 * such as a path or an address, is dropped. A capture is named only by its binding.
 */
export function evidencePayload(channel: string, x: Record<string, unknown>) {
	const scope = {
		entityId: textField(x.entityId, 120, idPattern),
		commit: textField(x.commit, 40, commitPattern),
		branch: textField(x.branch, 255),
		mode: enumField(x.mode, modes)
	};
	if (channel !== 'evidence:artifact') return scope;
	return {
		...scope,
		side: enumField(x.side, sides),
		recordId: textField(x.recordId, 64, hashPattern),
		scenarioId: textField(x.scenarioId, 120, idPattern),
		state: textField(x.state, 120, idPattern),
		evidenceId: textField(x.evidenceId, 120, idPattern),
		viewport: nullableText(x.viewport, idPattern),
		sha256: textField(x.sha256, 64, hashPattern),
		notesRevision: pinned(x.notesRevision),
		evidenceRevision: pinned(x.evidenceRevision)
	};
}
