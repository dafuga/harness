import { evidenceData } from '../../../../../desktop/tests/e2e/ui-evidence-data';
import { explorerArtifact } from '../../../../src/utils/explorer-ui/explorerArtifact';
import { illustratedData, desktopScreenFixtures } from './illustratedData';
import { desktopArtifactFixtures } from './desktopArtifactFixtures';
import { entitySectionsEvidenceFixtures } from './entitySectionsEvidenceFixtures';
import { createHash } from 'node:crypto';
import { commits, ids } from '../../../../test/entityUnits';
/** The existing sealed synthetic history, including checked JSON results, for browser previews. */
export async function buildData() {
	const data = await illustratedData(evidenceData());
	const desktopArtifacts = await desktopArtifactFixtures(data);
	const desktopScreens = await desktopScreenFixtures(data);
	await readResults(data.results, data.bytes);
	await readResults(desktopArtifacts.results, { ...data.bytes, ...desktopArtifacts.bytes });
	const reportArtifacts = await reportArtifactExamples(data);
	const entitySectionsEvidence = await entitySectionsEvidenceFixtures(data);
	return { ...data, desktopArtifacts, desktopScreens, reportArtifacts, entitySectionsEvidence };
}

/** This panel's examples retain their own original bytes, independently of other component fixtures. */
async function reportArtifactExamples(data: Awaited<ReturnType<typeof illustratedData>>) {
	const row = data.results[`${ids.filter}|commit|${commits.middle}`].behavior.rows.find(
		(item) => item.state === 'match' && item.kind === 'output'
	)!;
	const document: Record<string, unknown> = {
		...(row.afterRead!.document as Record<string, unknown>),
		scenario: 'Search orders by name',
		dataset: '12 orders with service and product lines'
	};
	delete document.fixture;
	const long = [
		'Orders reconciliation · 20 October 2026',
		'Query: SERVICE · sort: order number · customer account AC-42',
		...Array.from(
			{ length: 180 },
			(_, position) =>
				`Order A-${1048 + position} | account AC-${42 + (position % 8)} | Ready to ship | USD ${(84 + position * 1.25).toFixed(2)} | invoice paid | search matched SERVICE | indexed amount and delivery status match the stored order.`
		)
	].join('\n');
	const seal = async (text: string, mediaType: string) => {
		const body = Buffer.from(text);
		const sha256 = createHash('sha256').update(body).digest('hex');
		data.bytes[sha256] = { mediaType, data: [...body] };
		const capture = {
			...row.after!,
			sha256,
			mediaType,
			media: `media/${sha256}.${mediaType.includes('json') ? 'json' : 'txt'}`
		};
		const read = await explorerArtifact(capture, '', async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => new Uint8Array(body).buffer
		}));
		return { outcome: 'passed' as const, capture, read };
	};
	return {
		default: await seal(JSON.stringify(document, null, 2), 'application/json'),
		plain: await seal('The recorded command completed successfully.', 'text/plain'),
		long: await seal(long, 'text/plain')
	};
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
