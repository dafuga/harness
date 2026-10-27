import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, vi } from 'vitest';
import { createMatchScreenshot } from './browserScreenshot';
import { png } from './legacyStore';

/** Synthetic unit fixture: these bytes and identities are never retained as browser evidence. */
export async function assertScreenshotEvidenceBinding(): Promise<void> {
	const root = await mkdtemp(join(tmpdir(), 'harness-visual-binding-'));
	const evidence = join(root, 'evidence');
	const file = join(root, 'tests/e2e/app.spec.ts');
	const revision = 'a'.repeat(40);
	const buildId = 'b'.repeat(64);
	const bytes = png(128);
	try {
		await writeContracts(root, file);
		vi.stubEnv('HARNESS_VERIFY', '1');
		vi.stubEnv('HARNESS_VERIFY_CASE_ROOT', root);
		vi.stubEnv('HARNESS_VERIFY_REVISION', revision);
		vi.stubEnv('HARNESS_SCENARIO', 'initial-page');
		vi.stubEnv('HARNESS_EVIDENCE_DIR', evidence);
		vi.stubEnv('TAKE_SCREENSHOT', '1');
		const info = {
			file,
			titlePath: ['app.spec.ts', 'desktop viewport', 'app page initial state'],
			retry: 0,
			config: { updateSnapshots: 'none', ignoreSnapshots: false },
			attach: async () => undefined
		} as unknown as TestInfo;
		const page = {
			frames: () => [{ evaluate: async () => undefined }],
			viewportSize: () => ({ width: 1440, height: 900 }),
			locator: () => ({ getAttribute: async () => `harness-build:${buildId}` }),
			screenshot: async () => bytes
		} as unknown as Page;
		await expect(
			createMatchScreenshot(info)(page, 'initial-desktop.png', { fullPage: true })
		).rejects.toThrow('toHaveScreenshot() must be called during the test');
		await assertSyntheticCapture(evidence, revision, buildId, bytes);
	} finally {
		vi.unstubAllEnvs();
		await rm(root, { recursive: true, force: true });
	}
}

async function assertSyntheticCapture(
	evidence: string,
	revision: string,
	buildId: string,
	bytes: Buffer
) {
	const index = await readFile(join(evidence, 'captures.ndjson'), 'utf8').catch(
		(error: unknown) => {
			if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
				return '';
			throw error;
		}
	);
	expect(index, 'Generated visual cases register case-bound screenshots').not.toBe('');
	const capture = JSON.parse(index.trim());
	expect(capture).toMatchObject({
		evidence: 'screens',
		kind: 'screenshot',
		state: 'default',
		viewport: 'desktop',
		mediaType: 'image/png',
		provenance: 'actual-capture',
		server: { buildId, revision }
	});
	expect(JSON.parse(capture.note)).toEqual({
		unit: 'page.root',
		case: 'default.desktop',
		revision,
		sha256: createHash('sha256').update(bytes).digest('hex'),
		retry: 0
	});
	expect(await readFile(join(evidence, capture.file))).toEqual(bytes);
}

const unit = {
	id: 'page.root',
	testing: {
		cases: [
			{
				id: 'default.desktop',
				state: 'default',
				viewports: ['desktop'],
				test: {
					file: 'tests/e2e/app.spec.ts',
					title: 'desktop viewport > app page initial state'
				},
				expected: {
					kind: 'screenshot',
					file: '.cache/harness/visual-baselines/app.spec.ts/initial-desktop.png'
				}
			}
		]
	}
};
const scenario = {
	id: 'initial-page',
	units: ['page.root'],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	tests: [
		{
			id: 'page',
			runner: 'playwright',
			target: 'tests/e2e/app.spec.ts',
			cases: [{ unit: 'page.root', case: 'default.desktop' }]
		}
	],
	evidence: [
		{
			id: 'screens',
			kind: 'screenshot',
			states: ['default'],
			viewports: ['desktop'],
			required: true,
			provenance: 'actual-capture',
			build: 'app',
			capture: 'full-page'
		}
	]
};

async function writeContracts(root: string, testFile: string): Promise<void> {
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await mkdir(join(root, 'specification/scenarios'), { recursive: true });
	await mkdir(join(root, 'tests/e2e'), { recursive: true });
	await writeFile(testFile, '// disposable fixture\n');
	await writeFile(join(root, 'specification/units/page.root.json'), JSON.stringify(unit));
	await writeFile(
		join(root, 'specification/scenarios/initial-page.json'),
		JSON.stringify(scenario)
	);
}
