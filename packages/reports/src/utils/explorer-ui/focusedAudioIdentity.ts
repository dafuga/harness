import type { ExplorerCapture, ExplorerSide } from '../../models/explorer-ui/Explorer.types';

/** A focused audio key comes only from its sealed case and original revision binding. */
export function focusedAudioIdentity(side: ExplorerSide, found: ExplorerCapture) {
	const { capture } = found;
	if (!found.focused || capture.kind !== 'audio') return undefined;
	try {
		const binding = JSON.parse(capture.note ?? 'null') as Record<string, unknown> | null;
		if (!binding || Object.keys(binding).sort().join(',') !== 'case,revision,sha256,unit')
			return undefined;
		const { unit, revision, sha256 } = binding;
		const caseId = binding.case;
		if (typeof caseId !== 'string' || typeof revision !== 'string') return undefined;
		const valid = [
			typeof unit === 'string',
			/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(String(unit)),
			/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(caseId),
			revision === originalRevision(side, found),
			sha256 === capture.sha256
		].every(Boolean);
		if (!valid) return undefined;
		return { case: caseId, revision };
	} catch {
		return undefined;
	}
}

function originalRevision(side: ExplorerSide, found: ExplorerCapture): string {
	return found.inheritedFrom ?? side.commit;
}
