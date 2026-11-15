import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { z } from 'zod';
import { scenarioManifestSchema } from '../../../../src/core/development-tooling/unitTypes';
import { VideoCaptureService } from '../../../../src/services/verification-evidence/VideoCaptureService';
import { BuildIdentityService } from '../../../../src/services/verification-evidence/BuildIdentityService';
import { browserErrorCollector } from '../../../../test/support/browserTest';
import { record as search } from './support/component-previews/platformSearchVideo';
import { record as interaction } from './support/component-previews/platformInteractionVideo';
import { record as loading } from './support/component-previews/loadingStateVideo';

const contextSchema = z.object({
	schemaVersion: z.literal(1),
	repository: z.string().min(1),
	snapshot: z.string().min(1),
	source: z.object({
		commit: z.string().regex(/^[a-f0-9]{40}$/),
		tree: z.string().regex(/^[a-f0-9]{40}$/)
	}),
	pinned: z.object({ evidence: z.string().nullable(), notes: z.string().nullable() })
});
const allowed = new Set([
	'platform-search-video-pilot',
	'platform-interaction-video-pilot',
	'loading-state-video-pilot'
]);
const id = process.argv[2];
if (!allowed.has(id)) throw Error('Name one declared video pilot scenario.');
const context = contextSchema.parse(
	JSON.parse(process.env.HARNESS_VIDEO_CAPTURE_CONTEXT ?? 'null')
);
const scenario = scenarioManifestSchema.parse(
	JSON.parse(
		await readFile(join(context.snapshot, 'specification/scenarios', id + '.json'), 'utf8')
	)
);
if (!scenario.video) throw Error('The pilot scenario has no video declaration.');
const directory = process.env.HARNESS_EVIDENCE_DIR;
if (!directory)
	throw Error('Run the pilot through Harness verification so captures have an evidence directory.');
const home = join(context.snapshot, 'packages/reports/output/shell-fixture');
const build =
	scenario.evidence[0].build === 'reports'
		? join(context.snapshot, 'packages/reports/build')
		: home;
const compiled = await new BuildIdentityService().identify(build);
const reviewed = z
	.array(z.string().uuid())
	.max(256)
	.parse(JSON.parse(process.env.HARNESS_VIDEO_REVIEWED_FLAGS ?? '[]'));
const result = await new VideoCaptureService(context.repository).record({
	snapshot: context.snapshot,
	source: context.source,
	pinned: context.pinned,
	declaration: scenario.video,
	buildId: compiled?.buildId ?? 'not-built',
	evidence: 'motion',
	directory,
	env: process.env,
	...(process.env.HARNESS_VIDEO_RECORD_TASK === 'video-build-20261115'
		? { recordingAuthorization: { task: 'video-build-20261115' } }
		: {}),
	browserFactory: () => chromium.launch({ headless: true }),
	async loadScript({ clip, pendingFlags }) {
		if (pendingFlags.some((flag) => !reviewed.includes(flag.id)))
			throw Error(
				'Review each pending frame flag and provide its explicit reviewed ID before recording.'
			);
		const fixture = JSON.parse(await readFile(join(context.snapshot, clip.fixture), 'utf8'));
		const setup = {
			origin: 'http://127.0.0.1:5792',
			home,
			fixture,
			expectedBuild: { buildId: compiled?.buildId ?? 'not-built', revision: context.source.commit }
		};
		const script = clip.script.path.endsWith('/platformSearchVideo.ts')
			? search(setup)
			: clip.script.path.endsWith('/platformInteractionVideo.ts')
				? interaction(setup)
				: clip.script.path.endsWith('/loadingStateVideo.ts')
					? loading(setup)
					: null;
		if (!script) throw Error('No literal pilot factory is registered for this clip.');
		return {
			...script,
			diagnostics: browserErrorCollector('chromium'),
			addressedFlags: pendingFlags.map((flag) => flag.id)
		};
	}
});
console.log(
	JSON.stringify({
		source: result.source,
		recorded: result.recorded.length,
		reused: result.reused.length,
		clips: result.captures.length,
		batches: result.videoBatches.length
	})
);
