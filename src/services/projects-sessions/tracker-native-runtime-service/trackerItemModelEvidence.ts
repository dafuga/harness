// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerListedRun } from '../../../repositories/projects-sessions/TrackerRunReadRepository.types';
import type { TrackerModelEvidence } from '../../../utils/agents-providers/trackerEscalation.types';
import { isContextCheckpoint } from './trackerWatchdogContext';

type EvidenceRun = Pick<
	TrackerListedRun,
	| 'node'
	| 'id'
	| 'model'
	| 'effort'
	| 'state'
	| 'outcome'
	| 'failure_reason'
	| 'redone_by'
	| 'queued_at'
	| 'started_at'
	| 'ended_at'
>;
type Notes = TrackerItem['notes_log'];

const lostSession = /session (?:disappeared|(?:was )?lost)/i;
const failures = new Set(['failed', 'rejected', 'timed_out']);
// How Chief of Staff records a model-quality incident: a note naming the model that struggled.
const incidentNote = /^model[ -](?:quality[ -])?incident:\s*([a-z0-9][a-z0-9._:-]*[a-z0-9])/i;

/** The failed attempts and model-quality incidents recorded on one item. */
export function trackerItemModelEvidence(
	runs: readonly EvidenceRun[],
	notes: Notes
): TrackerModelEvidence {
	return {
		failed: runs
			.filter((run) => attemptFailed(run, notes))
			.map(({ model, effort }) => ({ model, effort: effort ?? null })),
		incidents: notes.flatMap(({ text }) => incidentNote.exec(text)?.[1] ?? [])
	};
}

function attemptFailed(run: EvidenceRun, notes: Notes) {
	if (run.redone_by != null) return true;
	if (run.state !== 'finished') return false;
	return failures.has(run.outcome ?? '') || lostWithoutHandoff(run, notes);
}

/** A started session that vanished without a context checkpoint is a failed attempt. */
export function lostWithoutHandoff(run: EvidenceRun, notes: Notes) {
	return (
		run.started_at != null &&
		run.outcome === 'abandoned' &&
		lostSession.test(run.failure_reason ?? '') &&
		!hasContextCheckpoint(run, notes)
	);
}

export function hasContextCheckpoint(run: EvidenceRun, notes: Notes): boolean {
	const start = Math.max(run.started_at ?? 0, run.queued_at ?? 0);
	return notes.some(
		({ node, at, text }) =>
			node === run.node &&
			Date.parse(at) >= start &&
			Date.parse(at) <= (run.ended_at ?? Infinity) &&
			isContextCheckpoint(text)
	);
}
