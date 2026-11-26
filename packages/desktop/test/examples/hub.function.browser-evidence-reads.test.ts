import type { ProjectReadGuard } from '../../src/adapters/explorer-ui/browser-project-adapter/browserBridge.types';
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { browserEvidenceReads } from '../../src/adapters/explorer-ui/browser-project-adapter/browserEvidenceReads';

const commit = 'a'.repeat(40);
const artifactBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const sha256 = createHash('sha256').update(artifactBytes).digest('hex');

type BrowserApiLike = Parameters<typeof browserEvidenceReads>[0];

function fakeApi(overrides: Partial<BrowserApiLike> = {}): BrowserApiLike {
	return {
		get: async <T>() => undefined as T,
		media: async () => ({ bytes: new Uint8Array(), mediaType: 'image/png' }),
		send: async () => undefined,
		bytes: async () => new Uint8Array(),
		...overrides
	} as BrowserApiLike;
}

function resolvingGuard(onGuard: (context: unknown) => void): ProjectReadGuard {
	return async (context, read) => {
		onGuard(context);
		return read('/resolved/project');
	};
}

function artifactInput() {
	return {
		projectId: 'project-demo',
		entityId: 'reports.page.overview',
		commit,
		branch: 'main',
		mode: 'commit' as const,
		side: 'after' as const,
		recordId: 'b'.repeat(64),
		scenarioId: 'reports.scenario.summary',
		state: 'shows-final-summary',
		evidenceId: 'evidence-1',
		viewport: 'desktop',
		sha256,
		notesRevision: commit,
		evidenceRevision: commit,
		ignored: 'dropped by the payload'
	};
}

function artifactPayload(input: ReturnType<typeof artifactInput>) {
	return {
		entityId: input.entityId,
		commit: input.commit,
		branch: input.branch,
		mode: input.mode,
		side: input.side,
		recordId: input.recordId,
		scenarioId: input.scenarioId,
		state: input.state,
		evidenceId: input.evidenceId,
		viewport: input.viewport,
		sha256: input.sha256,
		notesRevision: input.notesRevision,
		evidenceRevision: input.evidenceRevision
	};
}

test('Reads evidence through the project guard', async () => {
	const input = {
		projectId: 'project-demo',
		entityId: 'reports.page.overview',
		commit,
		branch: 'main',
		mode: 'current' as const,
		ignored: 'dropped by the payload'
	};
	const evidence = { evidence: [{ id: 'evidence-1', status: 'passed' }] };
	let requestedPath = '';
	let requestedPayload: unknown;
	let guardedInput: unknown;
	const api = fakeApi({
		get: async <T>(path: string, query?: Parameters<BrowserApiLike['get']>[1]) => {
			requestedPath = path;
			requestedPayload = query;
			return evidence as T;
		}
	});
	const guard = resolvingGuard((context) => (guardedInput = context));
	const bridge = browserEvidenceReads(api, guard);
	const output = await bridge.evidence!(input);
	const payload = { entityId: input.entityId, commit, branch: input.branch, mode: input.mode };

	expect(output).toEqual(evidence);
	expect(guardedInput).toBe(input);
	expect(requestedPath).toBe('/resolved/project/evidence');
	expect(requestedPayload).toEqual(payload);
	recordExampleCases(
		{
			unitId: 'hub.function.browser-evidence-reads',
			symbol: 'browserEvidenceReads',
			state: 'reads-evidence-through-the-project-guard',
			evidence: 'examples-cases',
			file: 'reads-evidence-through-the-project-guard.json'
		},
		[
			{
				name: 'reads the evidence JSON from the guarded project path',
				input,
				output: {
					result: evidence,
					path: requestedPath,
					payload,
					guardReceivedInput: input
				}
			}
		]
	);
});

test('Reads a verified artifact through the project guard', async () => {
	const input = artifactInput();
	let requestedPath = '';
	let requestedPayload: unknown;
	let guardedInput: unknown;
	const api = fakeApi({
		media: async (path: string, query?: Parameters<BrowserApiLike['media']>[1]) => {
			requestedPath = path;
			requestedPayload = query;
			return { bytes: artifactBytes, mediaType: 'image/png' };
		}
	});
	const guard = resolvingGuard((context) => (guardedInput = context));

	const bridge = browserEvidenceReads(api, guard);
	const output = await bridge.artifact!(input);
	const payload = artifactPayload(input);
	const summary = {
		bytes: [...output.bytes],
		mediaType: output.mediaType,
		sha256: output.sha256
	};

	expect(summary).toEqual({ bytes: [...artifactBytes], mediaType: 'image/png', sha256 });
	expect(guardedInput).toBe(input);
	expect(requestedPath).toBe('/resolved/project/artifact');
	expect(requestedPayload).toEqual(payload);
	recordExampleCases(
		{
			unitId: 'hub.function.browser-evidence-reads',
			symbol: 'browserEvidenceReads',
			state: 'reads-a-verified-artifact-through-the-project-guard',
			evidence: 'examples-cases',
			file: 'reads-a-verified-artifact-through-the-project-guard.json'
		},
		[
			{
				name: 'returns checked artifact bytes and binding from the guarded path',
				input,
				output: {
					result: summary,
					path: requestedPath,
					payload,
					guardReceivedInput: input
				}
			}
		]
	);
});
