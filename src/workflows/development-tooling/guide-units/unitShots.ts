// @harness-uid u_hf3mh6nbh4
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { evidenceRef, notesRef } from '../../../core/git-source-history/historyTypes';
import { HistoryStatusService } from '../../../services/verification-evidence/history-status-service/HistoryStatusService';
import { RevisionDetailService } from '../../../services/explorer-ui/revision-detail-service/RevisionDetailService';
import { checkedMedia } from '../../../utils/development-tooling/mediaPlace';
import { explorerEvidence } from '../../../../packages/reports/src/utils/explorer-ui/explorerEvidence';
import type { HarnessRevision } from '../../../../packages/reports/src/models/explorer-ui/Harness.types';
import type { UnitShots } from './unitShots.types';

/** The API's pinned verified-proof reader: validates seals, source trees and retained image bytes. */
export async function unitShots(root: string, entity: string, commit: string): Promise<UnitShots> {
	const listed = await new GitAdapter(root).run([
		'for-each-ref',
		'--format=%(refname)%00%(objectname)',
		notesRef,
		evidenceRef
	]);
	const refs = new Map(
		listed.split('\n').map((line) => line.split('\0')) as Array<[string, string]>
	);
	const notes = refs.get(notesRef) ?? null;
	const evidence = refs.get(evidenceRef) ?? null;
	if (!notes || !evidence)
		return { captures: [], gap: 'No attached Harness verification evidence at this revision.' };
	const history = new HistoryStatusService(root, { notes, evidence });
	const { detail } = await new RevisionDetailService(root, history).build(commit, checkedMedia);
	const selected = explorerEvidence(
		{ commit, mode: 'current', parent: null },
		{ head: detail as unknown as HarnessRevision, parent: null },
		{ id: entity }
	);
	return { captures: selected.after.captures, gap: selected.after.gap };
}
