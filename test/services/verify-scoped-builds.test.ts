import { measureWorkload } from '../support/measureWorkload';
import { withTempRepo } from '../support/temporary';
import { frameFlagFixture, seedTaskFrameFlag } from '../support/frameFlagFixture';
import { videoLibraryFixture } from '../support/videoCoverageFixture';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { verificationSample } from '../support/verificationSample';
import type { VerifyContext } from '../../src/workflows/verification-evidence/run-verify/verification-service/VerificationService.types';
import { afterEach, expect, test, vi } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { ImpactReport } from '../../src/core/development-tooling/impactTypes';
import {
	defaultVerifyConfig,
	type VerifyConfig
} from '../../src/core/verification-evidence/verifyTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import { emptySide } from '../../src/workflows/development-tooling/loadRevisions';
import { problem } from '../../src/workflows/verification-evidence/run-verify/verification-service/captureProblem';
import {
	SnapshotRunService,
	type SnapshotRun
} from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import { VerificationService } from '../../src/workflows/verification-evidence/run-verify/verification-service/VerificationService';

afterEach(() => vi.restoreAllMocks());

const commit = 'a'.repeat(40);
const reachedSnapshot = 'the verification reached its snapshot run';

/** A headless scenario that one unit covers, whose one output names the build `build`. */
function scenario(id: string, unit: string, build: string) {
	return scenarioManifestSchema.parse({
		schemaVersion: 1,
		id,
		title: `${id} flow`,
		kind: 'headless',
		units: [unit],
		states: [{ id: 'pages', title: 'Pages', coverage: 'required' }],
		viewports: [],
		tests: [{ id: 'flow', kind: 'e2e', runner: 'playwright', target: `tests/e2e/${id}.spec.ts` }],
		evidence: [
			{ id: 'flow', kind: 'output', states: ['pages'], viewports: [], build, required: true }
		]
	});
}
const webFlow = scenario('web-flow', 'function.web-route', 'web');
const docsFlow = scenario('docs-flow', 'function.docs-route', 'docs');
const config: VerifyConfig = {
	...defaultVerifyConfig,
	setup: [
		{ command: 'build web', builds: ['web'] },
		{ command: 'build docs', builds: ['docs'] }
	],
	builds: [
		{ id: 'web', directory: 'web/dist' },
		{ id: 'docs', directory: 'docs/dist' }
	]
};

/** Both scenarios at head, verified whole or scoped to `entity`; nothing runs before the snapshot. */
function verification(
	entity?: string,
	overrides: Partial<VerifyContext> = {}
): VerificationService {
	const impact = {
		base: 'none',
		head: commit,
		runtime: 'module',
		expanded: false,
		changed: [],
		units: { direct: [], indirect: [], added: [], removed: [] },
		tests: { selected: [], excluded: [], removed: [] },
		scenarios: { affected: [], unaffected: [] },
		uncertain: []
	} satisfies ImpactReport;
	return new VerificationService({
		root: process.cwd(),
		commit,
		tree: 'tree-head',
		baseCommit: null,
		requestedBase: null,
		base: emptySide(),
		head: { ...emptySide(), scenarios: [webFlow, docsFlow] },
		impact,
		config,
		env: {},
		entity,
		explained: async () => ({ required: [], entries: [], overlong: [], failures: [] }),
		...overrides
	});
}

/** The run a snapshot was built from; SnapshotRunService keeps it private. */
function runOf(snapshot: SnapshotRunService): SnapshotRun {
	return (snapshot as unknown as { run: SnapshotRun }).run;
}

/** Runs the verification until its snapshot, which stops it, and returns the run it was handed. */
async function snapshotRunOf(entity?: string): Promise<SnapshotRun> {
	const handed: SnapshotRun[] = [];
	const stopAtSnapshot = async function (this: SnapshotRunService) {
		handed.push(runOf(this));
		throw new Error(reachedSnapshot);
	};
	vi.spyOn(SnapshotRunService.prototype, 'execute').mockImplementation(stopAtSnapshot);
	await expect(verification(entity).run()).rejects.toThrow(reachedSnapshot);
	return handed[0];
}

test('an entity-scoped run hands its snapshot the builds its scoped scenarios need', async () => {
	const run = await snapshotRunOf('function.web-route');
	expect(run.needed).toEqual(new Set(['web']));
});

test('a full run hands its snapshot no scope, so every build is identified as before', async () => {
	const run = await snapshotRunOf();
	expect(run.needed).toBeUndefined();
});

/** A capture of running software whose evidence names the docs build, which served it. */
function docsCapture(): Gathered {
	const line = {
		evidence: 'flow',
		kind: 'output',
		state: 'pages',
		file: 'pages-flow.json',
		mediaType: 'application/json',
		provenance: 'actual-capture',
		server: { buildId: 'docs-1', revision: commit }
	};
	return { line } as unknown as Gathered;
}

/** The problem a docs capture raises under the builds a run declared, compiled and skipped. */
function docsProblem(builds: {
	declared: string[];
	compiled: Map<string, string>;
	skipped?: Set<string>;
}): string | undefined {
	const input = { scenario: docsFlow, commit, gathered: [], checkFailed: false, builds };
	return problem(input, docsCapture());
}

test('a capture that names a build its scoped run skipped is still a problem, reported as skipped', () => {
	const builds = {
		declared: ['web', 'docs'],
		compiled: new Map([['web', 'web-1']]),
		skipped: new Set(['docs'])
	};
	expect(docsProblem(builds)).toBe(
		'capture pages-flow.json names build docs, which this scoped run skipped'
	);
});

test('a capture that names a declared build setup did not produce still says so', () => {
	const builds = { declared: ['web', 'docs'], compiled: new Map([['web', 'web-1']]) };
	expect(docsProblem(builds)).toBe(
		'capture pages-flow.json names build docs, which setup did not produce'
	);
});

test('same-source reviewer flags rerun an otherwise inherited enrolled scenario', async () => {
	await measureWorkload('service.verification', 'pending-flags-invalidate-inherited-scenario', () =>
		withTempRepo(async ({ root, git }) => {
			const fixture = await frameFlagFixture(root, git);
			const video = videoLibraryFixture();
			video.clips[0].unit = webFlow.units[0];
			video.clips[0].id = 'play';
			video.graphs[0].unit = webFlow.units[0];
			video.graphs[0].clips = ['play'];
			video.playlists[0].clips = ['play'];
			const enrolled = scenarioManifestSchema.parse({
				...webFlow,
				kind: 'ui',
				viewports: video.viewports,
				video
			});
			const prior = verificationSample();
			prior.scenarios = [
				{
					id: enrolled.id,
					status: 'passed',
					testedRevision: fixture.reference.revision,
					states: []
				}
			];
			vi.spyOn(VerificationStoreRepository.prototype, 'load').mockReturnValue({
				record: prior,
				directory: root
			});
			const received: SnapshotRun[] = [];
			vi.spyOn(SnapshotRunService.prototype, 'execute').mockImplementation(async function (
				this: SnapshotRunService
			) {
				received.push(runOf(this));
				throw new Error(reachedSnapshot);
			});
			const service = () =>
				verification(undefined, {
					root,
					commit: fixture.reference.revision,
					baseRecord: prior.id,
					head: { ...emptySide(), scenarios: [enrolled] }
				});
			await expect(service().run()).rejects.toThrow(reachedSnapshot);
			expect(received.at(-1)?.videos).toEqual([]);
			await seedTaskFrameFlag(root, fixture.reference.revision, webFlow.units[0]);
			await expect(service().run()).rejects.toThrow(reachedSnapshot);
			expect(received.at(-1)?.videos?.map((scenario) => scenario.id)).toEqual([enrolled.id]);
		})
	);
});
