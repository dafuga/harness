import type { EntityEvidenceQuery } from "../../models/DesktopEvidence.types.ts";
import { evidencePayload } from "../../utils/evidencePayload";

export function hostedEvidencePath(
	input: EntityEvidenceQuery & { projectId: string },
	operation: 'evidence' | 'artifact'
) {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(input.projectId))
		throw new Error('Invalid hosted project.');
	const selected = evidencePayload(
		operation === 'artifact' ? 'evidence:artifact' : 'evidence:read',
		{ ...input }
	);
	const query = new URLSearchParams();
	const order = [
		'entityId',
		'commit',
		'branch',
		'mode',
		'side',
		'recordId',
		'scenarioId',
		'state',
		'evidenceId',
		'sha256',
		'viewport',
		'notesRevision',
		'evidenceRevision'
	];
	for (const [key, value] of Object.entries(selected).sort(
		([a], [b]) => order.indexOf(a) - order.indexOf(b)
	))
		if (value != null) query.set(key, String(value));
	return `/api/projects/${encodeURIComponent(input.projectId)}/${operation}?${query}`;
}
