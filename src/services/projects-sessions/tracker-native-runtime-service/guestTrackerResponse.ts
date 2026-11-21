// @harness-uid u_bl6xl2h4a3
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';

export function guestTrackerResponse(item: TrackerItem, run: TrackerRunReceipt, read: boolean) {
	const {
		id,
		title,
		kind,
		status,
		notes,
		notes_log,
		adapter_instructions,
		question,
		answer,
		needs_daniel,
		resolved,
		blocked_reason
	} = item;
	const summary = { id, status, run: { id: run.id, state: run.state, outcome: run.outcome } };
	if (!read) return Response.json(summary);
	const detail = {
		...summary,
		title,
		kind,
		notes,
		notes_log,
		adapter_instructions,
		question,
		answer,
		needs_daniel,
		resolved,
		blocked_reason
	};
	const body = JSON.stringify(detail);
	if (Buffer.byteLength(body) > 120 * 1024)
		return Response.json({ error: 'assigned item exceeds relay read size' }, { status: 413 });
	return new Response(body, { headers: { 'content-type': 'application/json' } });
}
