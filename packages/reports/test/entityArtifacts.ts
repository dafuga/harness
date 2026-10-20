import { createHash } from 'node:crypto';
import type { HarnessRevision } from '../src/models/Harness.types';
import type { ArtifactFetcher } from '../src/utils/explorerArtifact';
import { artifactRun } from '../src/utils/explorer-reading/explorerReading';
import { mediaFile } from '../src/utils/harnessEvidence';

/** What a synthetic end-to-end run of one state says it did, as a recorded result states it. */
export function runDocument(state: string, kind: string, takenAt: string) {
	const found = state === 'match' ? ['Order 1042 · Service call'] : [];
	return {
		scenario: 'Search across synthetic orders',
		environment: 'Bun · headless',
		fixture: 'Twelve synthetic orders',
		// When a run was taken is not what it did. A run declares that about itself under the one
		// name the reader sets aside, so two runs that differ only there are the same behaviour.
		[artifactRun.field]: { version: artifactRun.version, at: takenAt },
		steps: [
			'Open the orders page',
			{ action: 'search', text: state === 'match' ? 'SERVICE' : 'zzz' }
		],
		input: { searchText: state === 'match' ? 'SERVICE' : 'zzz' },
		...(kind === 'output' ? { output: found } : {}),
		assertions: [
			{ name: state === 'match' ? 'Matching order is listed' : 'No order is listed', passed: true },
			{ name: 'The list it was given is unchanged', passed: true, expected: 12, found: 12 }
		]
	};
}

type Altered = (document: ReturnType<typeof runDocument>, state: string) => unknown;

/**
 * Makes every headless capture of the given revisions a readable result: each gets the hash of
 * the bytes that are served for it, as a real history has it, and what is returned answers the
 * media path with those bytes. `altered` changes what one revision's runs say they did.
 */
export function servedArtifacts(
	revisions: HarnessRevision[],
	altered: Record<string, Altered> = {}
): ArtifactFetcher {
	const served = new Map<string, Buffer>();
	for (const detail of revisions) {
		const states = detail.records.flatMap((item) => item.scenarios).flatMap((item) => item.states);
		for (const state of states) {
			for (const capture of state.captures.filter((item) => item.mediaType.includes('json'))) {
				const stated = runDocument(
					state.id,
					capture.kind,
					`taken for ${detail.commit.slice(0, 7)}`
				);
				const document = altered[detail.commit]?.(stated, state.id) ?? stated;
				const bytes = Buffer.from(JSON.stringify(document, null, 2));
				capture.sha256 = createHash('sha256').update(bytes).digest('hex');
				served.set(mediaFile(capture), bytes);
			}
		}
	}
	return (address) => {
		const bytes = served.get(address.slice(address.lastIndexOf('/') + 1));
		const body = bytes ? new Uint8Array(bytes).buffer : new ArrayBuffer(0);
		return Promise.resolve({
			ok: Boolean(bytes),
			status: bytes ? 200 : 404,
			arrayBuffer: async () => body
		});
	};
}
