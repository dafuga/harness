import { measureWorkload } from '../support/measureWorkload';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withTempRepo } from '../support/temporary';
import { frameFlagFixture, seedTaskFrameFlag } from '../support/frameFlagFixture';
import { video, videoLibraryFixture } from '../support/videoCoverageFixture';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';
import { afterEach, expect, test, vi } from 'vitest';
import { SnapshotAdapter } from '../../src/adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import {
	defaultVerifyConfig,
	type VerifyConfig
} from '../../src/core/verification-evidence/verifyTypes';
import { BuildIdentityService } from '../../src/services/verification-evidence/BuildIdentityService';
import {
	CheckRunService,
	type CheckOutcome
} from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/CheckRunService';
import { SnapshotRunService } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import * as resourceAdmission from '../../src/utils/execution-runtimes/resourceWork';

afterEach(() => vi.restoreAllMocks());

/** Two builds: one setup step names none, and each other names the build it produces. */
const config: VerifyConfig = {
	...defaultVerifyConfig,
	setup: [
		{ command: 'install' },
		{ command: 'build web', builds: ['web'] },
		{ command: 'build docs', builds: ['docs'] }
	],
	builds: [
		{ id: 'web', directory: 'web/dist' },
		{ id: 'docs', directory: 'docs/dist' }
	]
};
/** Nothing is exported, linked or drifting, so the run goes straight to setup and the builds. */
const snapshot = {
	directory: '/snapshot',
	link: async () => false,
	misdeclared: () => [],
	drift: async () => ({ mutated: [], added: [] }),
	artifact: async () => undefined,
	remove: async () => undefined
} as unknown as SnapshotAdapter;

/** Runs the config with fakes for the snapshot, the command runner and build identity. */
async function execute(needed?: ReadonlySet<string> | 'all') {
	const ran: string[] = [];
	const identified: string[] = [];
	vi.spyOn(SnapshotAdapter, 'create').mockResolvedValue(snapshot);
	vi.spyOn(CheckRunService.prototype, 'run').mockImplementation(async (check) => {
		ran.push(check.command);
		return { passed: true } as CheckOutcome;
	});
	vi.spyOn(BuildIdentityService.prototype, 'declared').mockImplementation(async (_root, builds) => {
		identified.push(...builds.map((build) => build.id));
		const found = builds.map((build) => ({ ...build, buildId: `identity-${build.id}`, files: 1 }));
		return { found, failures: [] };
	});
	vi.spyOn(BuildIdentityService.prototype, 'changed').mockResolvedValue([]);
	const context = { directory: '/run', commit: 'commit', tree: 'tree', profile: 'test', env: {} };
	const service = new SnapshotRunService({ root: '/repo', config, context, needed });
	return { executed: await service.execute([]), ran, identified };
}

test('a scoped run runs the setup steps that name no build or a needed one, and skips the rest', async () => {
	const { ran } = await execute(new Set(['web']));
	expect(ran).toEqual(['install', 'build web']);
});

test('a scoped run identifies only the builds it needs and names the rest as skipped', async () => {
	const { executed, identified } = await execute(new Set(['web']));
	expect(identified).toEqual(['web']);
	expect(executed.builds).toEqual([
		{ id: 'web', directory: 'web/dist', buildId: 'identity-web', files: 1 }
	]);
	expect(executed.skippedBuilds).toEqual(['docs']);
});

test.each([undefined, 'all'] as const)(
	'without a scope (needed: %s) every step runs, every build is identified and none is skipped',
	async (needed) => {
		const { executed, ran, identified } = await execute(needed);
		expect(ran).toEqual(['install', 'build web', 'build docs']);
		expect(identified).toEqual(['web', 'docs']);
		expect(executed).not.toHaveProperty('skippedBuilds');
	}
);

test('enrolled snapshots expose only pending owning slots from original repository evidence', async () => {
	// The case tests real child-process transport; shared host queue admission has its own suite.
	vi.spyOn(resourceAdmission, 'resourceWork').mockImplementation(async (_request, action) =>
		action({ id: 'snapshot-capture-fixture', env: {}, track: () => undefined })
	);
	await measureWorkload(
		'service.snapshot-run',
		'pending-original-evidence-capture-environment',
		() =>
			withTempRepo(async ({ root, git }) => {
				const f = await frameFlagFixture(root, git);
				const flag = await seedTaskFrameFlag(root, f.reference.revision, video.unit);
				await seedTaskFrameFlag(root, f.reference.revision, 'component.other');
				vi.spyOn(VideoEvidenceService.prototype, 'plan').mockReturnValue({
					record: [
						{ unit: video.unit, clipId: 'play', viewport: 'desktop', inputHash: video.inputHash }
					],
					reuse: []
				});
				const scenario = pendingMotionScenario();
				const directory = join(root, '.cache/run');
				await mkdir(directory, { recursive: true });
				const context = {
					directory,
					commit: f.reference.revision,
					tree: git('rev-parse', 'HEAD^{tree}'),
					profile: 'test',
					env: { ...process.env }
				};
				const run = new SnapshotRunService({
					root,
					config: { ...defaultVerifyConfig, link: [], setup: [], tools: [], builds: [] },
					context,
					videos: [scenario]
				});
				const command = `node -e 'console.log(JSON.stringify({pending:process.env.HARNESS_PENDING_VIDEO_FLAGS,capture:process.env.HARNESS_VIDEO_CAPTURE_CONTEXT}))'`;
				const result = await run.execute([
					{
						id: 'pending-env',
						scenario: scenario.id,
						name: 'pending-env',
						kind: 'unit',
						runner: 'command',
						target: 'pending-env',
						cwd: '.',
						command,
						timeoutMs: 5000
					}
				]);
				expect(result.setupFailures).toEqual([]);
				expect(result.outcomes[0].passed).toBe(true);
				const printed = await readFile(join(directory, 'logs/pending-env.log'), 'utf8');
				expect(printed).toContain(flag.id);
				expect(printed).toContain('Inspect this edge');
				expect(printed).not.toContain('component.other');
				const capture = JSON.parse(JSON.parse(printed.trim()).capture);
				expect(capture).toMatchObject({
					schemaVersion: 1,
					repository: root,
					source: { commit: context.commit, tree: context.tree },
					slots: [
						{ unit: video.unit, clipId: 'play', viewport: 'desktop', inputHash: video.inputHash }
					]
				});
				expect(capture.snapshot).not.toBe(root);
				expect(capture.pinned.evidence).toMatch(/^[a-f0-9]{40}$/);
				expect(result).toHaveProperty('pendingVideoFlags.pending-motion.pending');
			})
	);
});

function pendingMotionScenario() {
	const declaration = videoLibraryFixture();
	declaration.clips[0].id = 'play';
	declaration.graphs[0].clips = ['play'];
	declaration.playlists[0].clips = ['play'];
	return scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'pending-motion',
		title: 'Pending motion',
		kind: 'ui',
		units: [video.unit],
		states: [{ id: 'pages', title: 'Pages', coverage: 'required' }],
		viewports: declaration.viewports,
		tests: [{ id: 'pending', kind: 'unit', runner: 'command', target: 'pending' }],
		evidence: [],
		video: declaration
	});
}
