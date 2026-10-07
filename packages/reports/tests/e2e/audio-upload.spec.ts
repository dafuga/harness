import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { audioFixture } from '../../test/audioFixture';
test('the active report form uploads a real audio file and preserves uncertain status', async ({
	page,
	request,
	baseURL
}) => {
	const store = new ReportRepository('/tmp/project-reports-e2e');
	const run = await store.begin({
		project: '/tmp/upload-project',
		title: 'Audio form review',
		mode: 'feature',
		environment: 'synthetic fixture'
	});
	await page.goto('/reports/' + run.id);
	await page.getByText('Add audio', { exact: true }).click();
	const form = page.locator('.upload-audio');
	await form.getByLabel('Audio title').fill('Form recording');
	await form.getByLabel('Source', { exact: true }).fill('Synthetic test tone');
	await form.getByLabel('Notes', { exact: true }).fill('Uploading is not acceptance proof.');
	await form
		.getByLabel('Audio file')
		.setInputFiles({ name: 'voice.wav', mimeType: 'audio/wav', buffer: audioFixture() });
	await form.getByRole('button', { name: 'Upload audio', exact: true }).click();
	await expect(form.getByRole('status')).toContainText('Audio added to gallery');
	const card = page.locator('.audio-card');
	await expect(card).toContainText('Form recording');
	await expect(card).toContainText('Not proven');
	await card.locator('audio').evaluate(async (audio: HTMLAudioElement) => {
		await audio.play();
	});
	await expect
		.poll(() => card.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
		.toBeGreaterThan(0);
	const saved = await store.get(run.id);
	expect(saved.evidence[0].storage).toBe('r2-evidence');
	const asset = '/api/reports/' + run.id + '/assets/' + saved.evidence[0].file;
	const range = await request.get(asset, { headers: { Range: 'bytes=-16' } });
	expect(range.status()).toBe(206);
	expect(await range.body()).toEqual(audioFixture().subarray(-16));
	expect((await request.get(asset, { headers: { Range: 'bytes=999999-' } })).status()).toBe(416);
	expect((await request.get('/api/reports/' + run.id + '/assets/unregistered.wav')).status()).toBe(
		404
	);
	const origin = baseURL!;
	const invalid = await request.post('/api/report-audio-upload', {
		headers: { Origin: origin },
		multipart: {
			reportId: run.id,
			title: 'Fake',
			audio: { name: 'fake.wav', mimeType: 'audio/wav', buffer: Buffer.from('not audio') }
		}
	});
	expect(invalid.status()).toBe(400);
	expect((await store.get(run.id)).evidence).toHaveLength(1);
	await store.seal(run.id);
	await store.finish(run.id, { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' });
	const sealed = await request.post('/api/report-audio-upload', {
		headers: { Origin: origin },
		multipart: {
			reportId: run.id,
			title: 'Late',
			audio: { name: 'late.wav', mimeType: 'audio/wav', buffer: audioFixture() }
		}
	});
	expect(sealed.status()).toBe(409);
	expect((await store.get(run.id)).evidence).toHaveLength(1);
	await page.reload();
	await expect(page.getByText('Add audio', { exact: true })).toHaveCount(0);
	expect(await readFile(store.directory(run.id) + '/assets/' + saved.evidence[0].file)).toEqual(
		audioFixture()
	);
});
