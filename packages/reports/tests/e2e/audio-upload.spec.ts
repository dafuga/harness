import { test, expect } from '../../../../test/support/browserTest';
import { readFile } from 'node:fs/promises';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { audioFixture } from '../../test/audioFixture';
import { fixtures } from './support/fixtures';
import { expectRetired, reportView } from './support/portableReport';
// The report page and its form are gone. What the form posted to is the upload service of the
// API, which a command line or another client still uses; the viewer still shows what it stored.
test('the upload service adds a real audio file to an active report and preserves uncertain status', async ({
	page,
	request,
	baseURL
}) => {
	const store = new ReportRepository(fixtures.reports);
	const run = await store.begin({
		project: fixtures.site('upload-project'),
		title: 'Audio form review',
		mode: 'feature',
		environment: 'synthetic fixture'
	});
	await expectRetired(page, '/reports/' + run.id);
	await expect(page.getByText('Add audio', { exact: true })).toHaveCount(0);
	const uploaded = await request.post('/api/report-audio-upload', {
		headers: { Origin: baseURL! },
		multipart: {
			reportId: run.id,
			title: 'Form recording',
			source: 'Synthetic test tone',
			note: 'Uploading is not acceptance proof.',
			audio: { name: 'voice.wav', mimeType: 'audio/wav', buffer: audioFixture() }
		}
	});
	expect(uploaded.status()).toBe(201);
	expect((await uploaded.json()).evidence).toHaveLength(1);
	await page.goto(await reportView(run.id));
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
	// The sealed report is still shown, with the one recording it had when it was sealed.
	await page.goto(await reportView(run.id));
	await expect(page.locator('.audio-card')).toHaveCount(1);
	expect(await readFile(store.directory(run.id) + '/assets/' + saved.evidence[0].file)).toEqual(
		audioFixture()
	);
});
