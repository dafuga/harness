import { evidenceData } from '../../../../../desktop/tests/e2e/ui-evidence-data';
import { explorerArtifact } from '../../../../src/utils/explorerArtifact';
import { illustratedData } from './illustratedData';
import { desktopArtifactFixtures } from './desktopArtifactFixtures';
/** The existing sealed synthetic history, including checked JSON results, for browser previews. */
export async function buildData() {
	const data = await illustratedData(evidenceData());
	const desktopArtifacts = await desktopArtifactFixtures(data);
	await readResults(data.results, data.bytes);
	await readResults(desktopArtifacts.results, { ...data.bytes, ...desktopArtifacts.bytes });
	return { ...data, desktopArtifacts };
}

async function readResults(
	results: ReturnType<typeof evidenceData>['results'],
	bytesByHash: ReturnType<typeof evidenceData>['bytes']
) {
	for (const result of Object.values(results)) {
		for (const row of result.behavior.rows) {
			for (const side of ['before', 'after'] as const) {
				const capture = row[side];
				if (!capture) continue;
				const bytes = bytesByHash[capture.sha256];
				if (!bytes) continue;
				row[`${side}Read`] = await explorerArtifact(capture, '', async () => ({
					ok: true,
					status: 200,
					arrayBuffer: async () => new Uint8Array(bytes.data).buffer
				}));
			}
		}
	}
}
