import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import { VideoCaptureService } from '../../src/services/verification-evidence/VideoCaptureService';
import { videoCaptureFixture, captureDeclaration } from './videoCaptureFixture';
import { browserErrorCollector } from './browserTest';
import type { TemporaryRepo } from './temporary.types';
import type { NativeRecordingSession } from '../../src/services/verification-evidence/NativeVideoRecorderService.types';

const signature = (state: string) => createHash('sha256').update(`${state}|160x120`).digest('hex');

export async function assertRealVideoCapture(repo: TemporaryRepo) {
	const f = await videoCaptureFixture(repo),
		declaration = structuredClone(captureDeclaration);
	declaration.clips = [declaration.clips[0]];
	declaration.playlists[0].clips = ['first'];
	Object.assign(declaration.clips[0], {
		checkpoints: [
			{ viewport: 'desktop', entrySignature: signature('ready'), exitSignature: signature('done') }
		]
	});
	const service = new VideoCaptureService(repo.root);
	const result = await service.record({
		...f.options(),
		declaration,
		browserFactory: () => chromium.launch({ headless: true }),
		loadScript: async () => ({
			diagnostics: browserErrorCollector('chromium'),
			prepare: async ({ page }) => {
				await page.setContent(
					"<style>body{margin:0;background:white}button{width:120px;height:80px;background:red}i{display:block;width:20px;height:10px;background:blue;animation:m 300ms linear infinite alternate}@keyframes m{to{transform:translateX(100px)}}</style><button onclick=\"this.textContent='done';this.style.background='green'\">ready</button><i></i>"
				);
			},
			perform: async ({ page, mark }) => {
				await mark('state', 'ready');
				await page.getByRole('button').click();
				expect(await page.getByRole('button').textContent()).toBe('done');
				await mark('edge', 'finish');
				await mark('state', 'done');
				await page.waitForTimeout(600);
			},
			checkpoint: async ({ page }: NativeRecordingSession) => {
				const actual = await page.getByRole('button').textContent();
				return signature(actual!);
			}
		})
	});
	expect(result.recorded).toHaveLength(1);
	expect(result.captures[0].video).toMatchObject({
		frameRate: 30,
		entrySignature: signature('ready'),
		exitSignature: signature('done'),
		states: [
			{ id: 'ready', atSeconds: expect.any(Number) },
			{ id: 'done', atSeconds: expect.any(Number) }
		]
	});
	expect(result.captures[0].video!.sourceFrameRate).toBeGreaterThan(20);
	expect(result.raw).toHaveLength(1);
}
