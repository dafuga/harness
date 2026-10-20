import { hubEvidenceOrigin } from '../hubEvidenceViews';
import { recordView } from '../../../../../src/utils/recordView';
import type { HubRecordStatusService } from '../../services/HubRecordStatusService';
import type { RecordStatus } from '../../../../../src/services/HistoryStatusService';
import type { HubAttachedRecord } from '../hubAttachedRecord';

async function hubEvidenceView(history: HubRecordStatusService, item: RecordStatus) {
	const loaded = await history.attached.load(item.evidence);
	const record = loaded.record;
	if (!record) return null;
	const originals = new Map<string, HubAttachedRecord>([[record.id, loaded]]);
	for (const id of new Set(record.scenarios.flatMap((s) => s.referencedRecord ?? []))) {
		const origin = await hubEvidenceOrigin(history, id);
		if (origin) originals.set(id, origin);
	}
	const media = new Map<string, { media: string | null; gap?: string }>();
	for (const scenario of record.scenarios) {
		const id = scenario.referencedRecord ?? record.id;
		for (const capture of scenario.states.flatMap((state) => state.captures)) {
			media.set(`${id}\n${capture.path}`, placedCapture(originals.get(id), capture, id));
		}
	}
	return recordView(record, {
		valid: item.valid,
		problems: item.problems,
		resolve: (capture, id) =>
			media.get(`${id}\n${capture.path}`) ?? {
				media: null,
				gap: 'not resolved'
			},
		origins: (id) => originals.get(id)?.record?.tests
	});
}

/** Project every attached status while retaining explicit invalid-record gaps. */
export async function hubEvidenceViews(history: HubRecordStatusService, items: RecordStatus[]) {
	return (await Promise.all(items.map((item) => hubEvidenceView(history, item)))).filter(
		(item) => item !== null
	);
}

function placedCapture(
	original: HubAttachedRecord | undefined,
	capture: { path: string; sha256: string; bytes: number },
	id: string
) {
	if (!original)
		return {
			media: null,
			gap: `inherited record ${id.slice(0, 12)} is not available`
		};
	const fact = original.facts.get(capture.path);
	const extension = /\.([a-z0-9]+)$/i.exec(capture.path)?.[1].toLowerCase() ?? 'bin';
	if (fact?.sha256 === capture.sha256 && fact.bytes === capture.bytes)
		return { media: `media/${capture.sha256}.${extension}` };
	return {
		media: null,
		gap:
			original.problems.find((problem) => problem.includes(capture.path)) ??
			`${capture.path} is not part of record ${id.slice(0, 12)}`
	};
}
