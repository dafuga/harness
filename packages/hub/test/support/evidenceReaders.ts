import type { Pins } from './evidenceReaders.types';
import { HubAttachedService } from '../../src/services/hub-attached-service/HubAttachedService';
import { HubRecordStatusService } from '../../src/services/HubRecordStatusService';
import { hubNotes } from '../../src/services/hub-evidence-service/hubNotes';
import type { HubSourceContext } from '../../src/utils/hubSource';
import { reachesIn, type EvidenceFixture } from './evidenceFixture';

/** The records of a fixture as the hub loads them at one pinned evidence commit. */
export function attachedAt(f: EvidenceFixture, base: HubSourceContext, within: string | null) {
	return new HubAttachedService({ base, within, reaches: reachesIn(f) });
}

/** What the notes and records of a fixture prove of each commit, at one pair of revisions. */
export function statusAt(f: EvidenceFixture, base: HubSourceContext, pins: Pins = f.pins) {
	return new HubRecordStatusService({
		notes: hubNotes(base, pins.notesRevision),
		attached: attachedAt(f, base, pins.evidenceRevision),
		tree: async (commit) => (f.git.commits.has(commit) ? f.git.tree(commit) : undefined)
	});
}
