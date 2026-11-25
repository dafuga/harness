// @harness-uid u_ytdcym5zkw
import type { Evidence, EvidenceVideo } from '../../../models/reports-media/Report.types';

const absent = 'Not recorded';

export function videoProvenance(item: Evidence): Evidence {
	return {
		...item,
		provenance: [...(item.provenance ?? []), ...clipRevision(item), ...clipProof(item.video)]
	};
}

function clipRevision(item: Evidence) {
	const video = item.video;
	return [
		{ label: 'Clip', value: video?.clipId ?? absent },
		{ label: 'Original revision', value: video?.reference?.revision ?? item.source ?? absent },
		{ label: 'Selected revision', value: video?.selectedRevision ?? absent },
		{ label: 'Freshness', value: video?.freshness ?? absent }
	];
}

function clipProof(video: EvidenceVideo | undefined) {
	return [
		{ label: 'Clip SHA-256', value: video?.sha256 ?? absent },
		{ label: 'Input hash', value: video?.inputHash ?? absent },
		{ label: 'Motion profile', value: video?.profile ?? absent },
		{ label: 'States', value: visits(video?.states) },
		{ label: 'Transitions', value: visits(video?.edges) }
	];
}

function visits(rows: EvidenceVideo['states'] | undefined): string {
	return rows?.map((row) => `${row.id} @ ${row.atSeconds}s`).join(', ') ?? '';
}
