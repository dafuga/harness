import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { fixture, bytes, git } from './run-fixture';
import { ProviderDiscoveryService } from '../src/services/provider-discovery-service/ProviderDiscoveryService';
import { prepareRun } from '../src/utils/prepareRun';

export const imageBytes = new Uint8Array(bytes);
export const imageHash = createHash('sha256').update(imageBytes).digest('hex');
export function capture(evidence = 'screen-a') {
	return {
		scenario: 'scenario.page',
		state: 'default',
		standing: 'fresh',
		usable: true,
		current: true,
		inheritedFrom: null,
		capture: {
			evidence,
			kind: 'screenshot',
			state: 'default',
			viewport: 'desktop',
			status: 'passed',
			path: 'untrusted/path.png',
			sha256: imageHash,
			mediaType: 'image/png',
			capturedAt: '2026-01-01T00:00:00Z',
			media: null
		}
	};
}
function currentResponse(query: { projectId: string; commit: string }) {
	const side = {
		commit: query.commit,
		detail: null,
		record: {
			id: 'record-a',
			status: 'passed',
			valid: true,
			problems: [],
			source: { commit: query.commit, base: null },
			scenarios: []
		},
		captures: [capture()],
		coverage: [],
		gap: null
	};
	return {
		scope: {
			mode: 'commit',
			branch: 'main',
			tip: query.commit,
			commit: query.commit,
			atTip: true,
			parent: null
		},
		identity: {
			projectId: query.projectId,
			principalId: 'fixture',
			repositoryId: 'fixture',
			requestedRef: 'main',
			sourceCommit: query.commit,
			sourceTree: query.commit,
			notesRef: 'refs/notes/harness',
			notesRevision: 'b'.repeat(40),
			evidenceRef: 'refs/harness/evidence',
			evidenceRevision: 'c'.repeat(40),
			historyIndexRevision: null,
			artifactHash: null,
			profile: null
		},
		evidence: {
			mode: 'commit',
			scenarios: [],
			after: side,
			before: null,
			initial: false,
			incomparable: false
		},
		behavior: {}
	};
}

export async function currentFixture(planned = false) {
	const f = await fixture();
	const { catalog } = f.session.requireProject();
	const entity = catalog.entity.bind(catalog);
	vi.spyOn(catalog, 'entity').mockImplementation(async (...args) => ({
		...(await entity(...args)),
		planned
	}));
	const query = {
		projectId: f.session.projectId!,
		entityId: f.request.entityId,
		branch: 'main',
		commit: git(f.root, 'rev-parse', 'HEAD'),
		mode: 'commit' as const
	};
	const response = currentResponse(query);
	const evidence = {
		evidence: vi.fn().mockImplementation(async (input: { mode: string; commit: string }) => {
			if (input.mode === 'current' && git(f.root, 'rev-parse', 'HEAD') !== input.commit)
				throw new Error(`Commit ${input.commit.slice(0, 7)} is no longer the tip of branch main.`);
			return response;
		}),
		artifact: vi
			.fn()
			.mockResolvedValue({ bytes: imageBytes, sha256: imageHash, mediaType: 'image/png' })
	};
	const preparation = {
		session: f.session,
		generator: f.generator,
		emit: vi.fn(),
		evidence,
		providers: new ProviderDiscoveryService({ codex: f.runner, claude: f.runner })
	};
	const prepare = async (request = f.request) => {
		const context = await prepareRun(
			preparation,
			{ ...request, projectId: query.projectId },
			new AbortController()
		);
		response.scope.tip = git(f.root, 'rev-parse', 'HEAD');
		response.scope.atTip = response.scope.tip === query.commit;
		return context;
	};
	return { f, query, response, evidence, prepare };
}
