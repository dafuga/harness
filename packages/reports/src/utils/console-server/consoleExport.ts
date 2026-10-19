import type { ConsoleExportInput } from '../consoleExport';
import type { HarnessIndex, HarnessRevision } from '../../models/Harness.types';
import { harnessReport } from './harnessEvidence';
import { portablePage } from './portablePage';
import { type PortableAssets } from '../portablePage';

function base64(bytes: Uint8Array): string {
	let binary = '';
	for (let start = 0; start < bytes.length; start += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
	}
	return btoa(binary);
}

/**
 * One recorded verification as the portable report page, with its media inlined. It uses only
 * what it is handed and web platform APIs, so the same export runs in Harness's own server and
 * in a host on Workers. Undefined when the commit or its record is not in the history.
 */
export async function consoleExport(
	input: ConsoleExportInput,
	assets: PortableAssets
): Promise<string | undefined> {
	const index = JSON.parse(input.index) as HarnessIndex;
	const detail = JSON.parse(input.detail) as HarnessRevision;
	const summary = index.revisions.find((item) => item.commit === input.commit);
	const record =
		detail.records.find((item) => item.id === input.record) ??
		detail.records.find((item) => item.valid && item.status === 'passed') ??
		detail.records[0];
	if (!summary || !record) return undefined;
	const report = harnessReport(summary, detail, record);
	for (const item of report.evidence) {
		const media = item.missing ? undefined : await input.media(item.file);
		if (!media) item.missing = true;
		else item.file = `data:${media.type};base64,${base64(media.bytes)}`;
	}
	return portablePage(report, assets);
}
