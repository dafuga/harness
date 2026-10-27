import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { EvidenceAttachService } from '../../src/services/verification-evidence/evidence-attach-service/EvidenceAttachService';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import { png } from './legacyStore';
import { verificationSample } from './verificationSample';
import type {
	ScreenshotFixtureOptions,
	ScreenshotFixtureSeed
} from './screenshotBaselineFixture.types';

/** Seal synthetic fixture bytes in a disposable Git repository; this is not visual proof. */
export async function attachSyntheticScreenshot(
	root: string,
	commit: string,
	tree: string,
	options: ScreenshotFixtureOptions
) {
	const seed = fixtureSeed(commit, tree, options);
	const record = syntheticRecord(seed);
	const store = new VerificationStoreRepository(root);
	const directory = store.directoryFor(commit, record.startedAt);
	await mkdir(join(directory, dirname(seed.path)), { recursive: true });
	await mkdir(join(directory, 'logs'), { recursive: true });
	await writeFile(join(directory, seed.path), seed.image);
	await writeFile(join(directory, 'logs/visual.log'), seed.log);
	await writeFile(join(directory, 'case-results.ndjson'), seed.caseBytes);
	await store.save(record, directory);
	await new EvidenceAttachService(root).attach(commit, { record, directory });
	return { record, image: seed.image, sha256: seed.sha256 };
}

function fixtureSeed(
	commit: string,
	tree: string,
	options: ScreenshotFixtureOptions
): ScreenshotFixtureSeed {
	const image = options.corruptImage ? Buffer.from('not a PNG') : png(128);
	const sha256 = digest(image);
	const note = JSON.stringify({
		unit: 'page.fixture',
		case: options.bindingCase ?? 'default.desktop',
		revision: commit,
		sha256
	});
	const outcome = {
		file: 'test/page.spec.ts',
		title: 'fixture desktop',
		revision: commit,
		status: options.skipped ? ('skipped' as const) : ('failed' as const),
		retry: 0
	};
	return {
		commit,
		tree,
		options,
		image,
		sha256,
		note,
		outcome,
		buildId: 'b'.repeat(64),
		path: `evidence/${commit}/visual/page/desktop.png`,
		caseBytes: Buffer.from(JSON.stringify(outcome) + '\n'),
		log: Buffer.from('Synthetic missing baseline fixture.\n')
	};
}

function syntheticRecord(seed: ScreenshotFixtureSeed): VerificationRecord {
	const draft: Partial<VerificationRecord> = verificationSample();
	delete draft.id;
	return sealRecord({
		...(draft as Omit<VerificationRecord, 'id'>),
		source: { commit: seed.commit, tree: seed.tree, base: null },
		status: 'failed',
		components: [],
		measurements: [],
		builds: [{ id: 'site', directory: 'build', buildId: seed.buildId, files: 1 }],
		gates: {
			snapshot: seed.options.snapshotFailed ? 'failed' : 'passed',
			registry: 'passed',
			cases: 'failed',
			scenarios: 'failed'
		},
		failures: ['Synthetic missing baseline fixture.'],
		tests: [syntheticCheck(seed)],
		scenarios: [syntheticScenario(seed)]
	});
}

function syntheticCheck(seed: ScreenshotFixtureSeed): VerificationRecord['tests'][number] {
	return {
		id: 'visual:page',
		kind: 'e2e',
		runner: 'playwright',
		target: 'test/page.spec.ts',
		status: 'failed',
		durationMs: 1,
		log: { path: 'logs/visual.log', bytes: seed.log.length, sha256: digest(seed.log) },
		cases: {
			outcomes: [seed.outcome],
			artifact: {
				path: 'case-results.ndjson',
				bytes: seed.caseBytes.length,
				sha256: digest(seed.caseBytes)
			}
		}
	};
}

function syntheticScenario(seed: ScreenshotFixtureSeed): VerificationRecord['scenarios'][number] {
	return {
		id: 'visual',
		status: 'failed',
		testedRevision: seed.commit,
		states: [
			{
				id: 'default',
				coverage: 'required',
				captures: [
					{
						evidence: 'screens',
						kind: 'screenshot',
						state: 'default',
						viewport: 'desktop',
						status: 'failed',
						path: seed.path,
						sha256: seed.sha256,
						bytes: seed.image.length,
						mediaType: 'image/png',
						capturedAt: '2026-01-01T00:00:00Z',
						provenance: seed.options.provenance ?? 'actual-capture',
						server: {
							revision: seed.commit,
							buildId: seed.options.wrongBuild ? 'c'.repeat(64) : seed.buildId
						},
						note: seed.note
					}
				]
			}
		]
	};
}

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
