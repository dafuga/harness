import {
	evidenceRef,
	notesRef,
	sourceArchivePrefix
} from '../../../core/git-source-history/historyTypes';

/** The refs Harness history consists of, and the patterns that match them on a remote. */
export function historyRefs(): { evidence: string; notes: string; archives: string } {
	return { evidence: evidenceRef, notes: notesRef, archives: `${sourceArchivePrefix}*` };
}
