import type { Recorded, Opened, Reads, At } from './recorded-evidence-fixture.types';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { indexedRepo } from '../../../test/support/historyIndexFixture';
import type { ExplorerCapture } from '../../reports/src/models/Explorer.types';
import type {
	EntityEvidenceQuery,
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../src/models/DesktopEvidence.types';
import { ProjectSessionService } from '../src/services/ProjectSessionService';
import { desktopBridge } from '../src/utils/desktopBridge';

export const page = 'page.titles';
export const clock = 'service.clock';
export const title = 'service.title';
export const notListed = /not listed/;

export const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/**
 * The indexed repository of the root fixtures: a root commit whose record failed, a verified
 * baseline, a verified change that inherits the clock scenario, and an unverified tip of main.
 * Branch `verified` ends at the verified change; `merged` ends at a merge whose first parent is
 * that change and whose second is the root commit.
 */
export async function recordedRepo(): Promise<Recorded> {
	const { repo, commits } = await indexedRepo();
	await repo.git(['config', '--local', 'user.name', 'Harness Fixture']);
	await repo.git(['config', '--local', 'user.email', 'fixture@harness.invalid']);
	await repo.git(['branch', 'verified', commits.changed]);
	const tree = await repo.git(['rev-parse', `${commits.changed}^{tree}`]);
	const parents = ['-p', commits.changed, '-p', commits.failed];
	const merged = await repo.git(['commit-tree', tree, ...parents, '-m', 'chore: merge']);
	await repo.git(['branch', 'merged', merged]);
	return { repo, root: await realpath(repo.root), commits: { ...commits, merged } };
}

/** The session of one window on a repository, with the two reads of its bridge. */
export async function opened(root: string): Promise<Opened> {
	const session = new ProjectSessionService();
	await session.open(root);
	const unused = undefined as never;
	const context = { session, providers: unused, runs: unused, choose: async () => null };
	const bridge = desktopBridge(context);
	return {
		session,
		projectId: session.projectId as string,
		evidence: (input) => (bridge.evidence as Reads['evidence'])(input),
		artifact: (input) => (bridge.artifact as Reads['artifact'])(input)
	};
}

export const asked = (reader: Opened, entityId: string, at: At): EntityEvidenceQuery => ({
	projectId: reader.projectId,
	entityId,
	...at
});

/** The request for one listed capture, filled as the viewer fills it from an answer. */
export function binding(
	result: EntityEvidenceResult,
	scope: EntityEvidenceQuery,
	found: ExplorerCapture,
	side: 'before' | 'after' = 'after'
): EvidenceArtifactQuery {
	return {
		...scope,
		side,
		recordId: result.evidence[side]?.record?.id ?? '',
		scenarioId: found.scenario,
		state: found.state,
		evidenceId: found.capture.evidence,
		viewport: found.capture.viewport ?? null,
		sha256: found.capture.sha256,
		notesRevision: result.identity.notesRevision,
		evidenceRevision: result.identity.evidenceRevision
	};
}

/** The evidence of an entity with the request for the first capture of its after side. */
export async function shown(reader: Opened, entityId: string, at: At) {
	const scope = asked(reader, entityId, at);
	const result = await reader.evidence(scope);
	const [found] = result.evidence.after.captures;
	return { scope, result, found, query: binding(result, scope, found) };
}

export type { Recorded, At, Opened } from './recorded-evidence-fixture.types';
