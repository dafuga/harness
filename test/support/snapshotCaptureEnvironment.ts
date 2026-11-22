import { expect, vi } from 'vitest';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { frameFlagFixture, seedTaskFrameFlag } from './frameFlagFixture';
import { video, videoLibraryFixture } from './videoCoverageFixture';
import { scenarioManifestSchema } from '../../src/core/unitTypes';
import { VideoEvidenceService } from '../../src/services/verification-evidence/VideoEvidenceService';
import { SnapshotRunService } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import { defaultVerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import type { TemporaryRepo } from './temporary.types';

export async function assertSnapshotCaptureEnvironment(repo: TemporaryRepo) {
	const f = await pendingEnvironmentFixture(repo);
	const command = `node -e 'console.log(JSON.stringify({pending:process.env.HARNESS_PENDING_VIDEO_FLAGS,capture:process.env.HARNESS_VIDEO_CAPTURE_CONTEXT}))'`;
	const result = await f.run.execute([
		{
			id: 'pending-env',
			scenario: f.scenario.id,
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
	const printed = await readFile(join(f.context.directory, 'logs/pending-env.log'), 'utf8');
	expect(printed).toContain(f.flag.id);
	expect(printed).toContain('Inspect this edge');
	expect(printed).not.toContain('component.other');
	const capture = JSON.parse(JSON.parse(printed.trim()).capture);
	expect(capture).toMatchObject({
		schemaVersion: 1,
		repository: repo.root,
		source: { commit: f.context.commit, tree: f.context.tree },
		slots: [{ unit: video.unit, clipId: 'play', viewport: 'desktop', inputHash: video.inputHash }]
	});
	expect(capture.snapshot).not.toBe(repo.root);
	expect(capture.pinned.evidence).toMatch(/^[a-f0-9]{40}$/);
	expect(result).toHaveProperty('pendingVideoFlags.pending-motion.pending');
}

async function pendingEnvironmentFixture({ root, git }: TemporaryRepo) {
	const f = await frameFlagFixture(root, git);
	const flag = await seedTaskFrameFlag(root, f.reference.revision, video.unit);
	await seedTaskFrameFlag(root, f.reference.revision, 'component.other');
	vi.spyOn(VideoEvidenceService.prototype, 'plan').mockReturnValue({
		record: [{ unit: video.unit, clipId: 'play', viewport: 'desktop', inputHash: video.inputHash }],
		reuse: []
	});
	const scenario = pendingMotionScenario(),
		directory = join(root, '.cache/run');
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
	return { context, scenario, flag, run };
}

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
