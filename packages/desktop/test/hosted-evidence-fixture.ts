import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RemoteHttpProjectAdapter } from '../src/adapters/RemoteHttpProjectAdapter';
import type {
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../src/models/DesktopEvidence.types';
import type { CacheStatus } from '../src/models/ProjectContext.types';
import { ProjectionCacheService } from '../src/services/ProjectionCacheService';
import { recordedAnswer } from '../src/utils/recordedAnswer';
import { head, home, parent, sampleDetail, sampleScope } from './recorded-sample';

export const token = 'fixture-private-token';
export const notes = 'c'.repeat(40);
export const evidence = 'd'.repeat(40);
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** A PNG as far as its first bytes say, which is what a screenshot is told by. */
export const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
/** What the viewer asks of the shared project `p`: the head commit against its first parent. */
export const asked = {
	projectId: 'p',
	entityId: home,
	commit: head,
	branch: 'main',
	mode: 'commit' as const
};
export interface Pins {
	notesRevision: string | null;
	evidenceRevision: string | null;
}
export interface AnswerAt extends Pins {
	principalId: string;
	projectId: string;
	mode: 'current' | 'commit';
	entityId: string;
}
const usual: AnswerAt = {
	principalId: 'alice',
	projectId: 'p',
	notesRevision: notes,
	evidenceRevision: evidence,
	mode: 'commit',
	entityId: home
};

/** The request for one capture: its binding, and the revisions an answer was pinned to. */
export function captureOf(
	bytes: Uint8Array,
	pins: Pins = usual
): EvidenceArtifactQuery & { projectId: string } {
	return {
		...asked,
		side: 'after',
		recordId: 'e'.repeat(64),
		scenarioId: 'home-page',
		state: 'filled',
		evidenceId: 'kept',
		viewport: 'desktop',
		sha256: sha256(bytes),
		notesRevision: pins.notesRevision,
		evidenceRevision: pins.evidenceRevision
	};
}

/** An evidence answer as a hub sends it: derived as the local read derives it, then as JSON. */
export function hubAnswer(at: Partial<AnswerAt> = {}): EntityEvidenceResult {
	const read = { ...usual, ...at };
	const identity = {
		collaborationRevision: null,
		principalId: read.principalId,
		projectId: read.projectId,
		repositoryId: 7,
		requestedRef: 'main',
		sourceCommit: head,
		sourceTree: 'f'.repeat(40),
		notesRef: 'refs/notes/harness',
		notesRevision: read.notesRevision,
		evidenceRef: 'refs/heads/harness-evidence',
		evidenceRevision: read.evidenceRevision,
		historyIndexRevision: null,
		artifactHash: null,
		profile: null
	};
	const revisions = { head: sampleDetail(head), parent: sampleDetail(parent) };
	const scope = sampleScope(read.entityId, read.mode);
	const answer = recordedAnswer({ scope, identity, revisions });
	return JSON.parse(JSON.stringify(answer));
}

export interface HubState {
	/** Who the kept session says it is, and who the hub says that session is. */
	principal: string;
	actor: string;
	/** What every project route answers when it is not 200, with the public code it states. */
	status: number;
	error: string;
	/** The revisions the hub reads notes and evidence at. */
	notes: string | null;
	evidence: string | null;
	/** Stands in for the evidence answer, for a test that sends something else. */
	answer: ((projectId: string) => unknown) | null;
	artifact: { bytes: Uint8Array; mediaType: string };
	seen: Array<{ url: string; authorization: string | undefined }>;
}

function json(response: ServerResponse, status: number, value: unknown) {
	response.statusCode = status;
	response.setHeader('content-type', 'application/json');
	response.end(JSON.stringify(value));
}

function answered(state: HubState, request: IncomingMessage, response: ServerResponse) {
	const url = new URL(request.url ?? '/', 'http://localhost');
	state.seen.push({ url: request.url ?? '', authorization: request.headers.authorization });
	const actor = state.actor ? { id: state.actor, emailVerified: true } : null;
	if (url.pathname === '/api/auth/status') return json(response, 200, { actor });
	if (state.status !== 200) return json(response, state.status, { error: state.error });
	const [projectId, operation] = url.pathname.split('/').slice(3);
	if (operation === 'artifact') {
		response.setHeader('content-type', state.artifact.mediaType);
		response.setHeader('cache-control', 'no-store');
		response.setHeader('x-content-type-options', 'nosniff');
		return response.end(state.artifact.bytes);
	}
	if (operation !== 'evidence') return json(response, 404, { error: 'not-found' });
	const at = {
		principalId: state.actor,
		projectId,
		notesRevision: state.notes,
		evidenceRevision: state.evidence,
		mode: url.searchParams.get('mode') as AnswerAt['mode'],
		entityId: url.searchParams.get('entityId') ?? home
	};
	return json(response, 200, state.answer ? state.answer(projectId) : hubAnswer(at));
}

/**
 * SYNTHETIC HUB for the hosted evidence reads: the two routes of the fixed contract and the
 * session check, over real HTTP on this computer, with a real cache directory beside it.
 */
export async function hubFixture() {
	const root = await mkdtemp(join(tmpdir(), 'hosted-evidence-'));
	const directory = join(root, 'cache');
	const state: HubState = {
		principal: 'alice',
		actor: 'alice',
		status: 200,
		error: 'forbidden',
		notes,
		evidence,
		answer: null,
		artifact: { bytes: png, mediaType: 'image/png' },
		seen: []
	};
	const server = createServer((request, response) => answered(state, request, response));
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	const cache = new ProjectionCacheService(directory);
	const credentials = async () => ({ origin, principalId: state.principal, token });
	const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
	return {
		origin,
		directory,
		state,
		cache,
		/** A client as the app starts one; `events` receives what it says of its kept copies. */
		adapter: (events: CacheStatus[] = [], fetcher?: typeof fetch) =>
			new RemoteHttpProjectAdapter({
				origin,
				cache,
				credentials,
				fetch: fetcher,
				onCacheStatus: (event) => events.push(event)
			}),
		/** The names of the kept files, in order. */
		files: async () => (await readdir(directory).catch(() => [] as string[])).sort(),
		/** The routes that were asked, without what was asked of them. */
		routes: () => state.seen.map((request) => request.url.split('?')[0]),
		close,
		cleanup: async () => {
			await close();
			await rm(root, { recursive: true, force: true });
		}
	};
}
