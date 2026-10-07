import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { audioFixture } from '../../test/audioFixture';
test('paired upload validates both originals, attaches phases and protects finalized history', async ({
	page,
	request,
	baseURL
}) => {
	const store = new ReportRepository('/tmp/project-reports-e2e');
	const run = await store.begin({
		project: '/tmp/upload-pair',
		title: 'Paired upload review',
		mode: 'feature',
		environment: 'Synthetic transport fixture'
	});
	await page.goto('/reports/' + run.id);
	await page.getByText('Add audio', { exact: true }).click();
	const form = page.locator('.upload-audio');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	if (process.env.TAKE_SCREENSHOT === 'true') {
		const directory = 'output/evidence/' + (process.env.SCREENSHOT_LABEL || 'current');
		await mkdir(directory, { recursive: true });
		await form.screenshot({ path: join(directory, 'audio-paired-upload.png') });
	}
	await expect(
		form.getByRole('combobox', { name: 'Audio upload mode', exact: true })
	).toBeVisible();
	await form
		.getByRole('combobox', { name: 'Audio upload mode', exact: true })
		.selectOption('comparison');
	await form.getByLabel('Audio title', { exact: true }).fill('Uploaded comparison');
	await form.getByLabel('Source', { exact: true }).fill('Synthetic tone test');
	await form
		.getByLabel('Before audio file', { exact: true })
		.setInputFiles({ name: 'before.wav', mimeType: 'audio/wav', buffer: audioFixture(6, 220) });
	await form
		.getByLabel('After audio file', { exact: true })
		.setInputFiles({ name: 'after.wav', mimeType: 'audio/wav', buffer: audioFixture(6, 440) });
	await form.getByRole('button', { name: 'Upload audio comparison', exact: true }).click();
	await expect(form.getByRole('status')).toContainText('Audio comparison added to gallery');
	await page
		.getByRole('button', {
			name: 'Open audio comparison: Uploaded comparison',
			exact: true
		})
		.click();
	const pair = page.getByRole('dialog');
	await expect(pair.locator('audio')).toHaveCount(2);
	await expect(pair.getByRole('group', { name: 'Before recording', exact: true })).toContainText(
		'Not proven'
	);
	await expect(pair.getByRole('group', { name: 'After recording', exact: true })).toContainText(
		'Not proven'
	);
	const saved = await store.get(run.id);
	expect(saved.evidence.map((item) => item.storage)).toEqual(['r2-evidence', 'r2-evidence']);
	expect(saved.evidence.map((item) => item.phase)).toEqual(['before', 'after']);
	expect(saved.evidence[0].comparison).toBeTruthy();
	expect(saved.evidence[1].comparison).toBe(saved.evidence[0].comparison);
	for (const [index, frequency] of [
		[0, 220],
		[1, 440]
	]) {
		const result = await request.get(
			'/api/reports/' + run.id + '/assets/' + saved.evidence[index].file
		);
		expect(await result.body()).toEqual(audioFixture(6, frequency));
	}
	const payload = {
		reportId: run.id,
		title: 'Invalid comparison',
		before: { name: 'before.wav', mimeType: 'audio/wav', buffer: audioFixture() },
		after: { name: 'after.wav', mimeType: 'audio/wav', buffer: Buffer.from('fake') }
	};
	expect(
		(
			await request.post('/api/report-audio-comparison', {
				headers: { Origin: baseURL! },
				multipart: payload
			})
		).status()
	).toBe(400);
	expect((await store.get(run.id)).evidence).toHaveLength(2);
	await store.seal(run.id);
	await store.finish(run.id, { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' });
	payload.after.buffer = audioFixture();
	expect(
		(
			await request.post('/api/report-audio-comparison', {
				headers: { Origin: baseURL! },
				multipart: payload
			})
		).status()
	).toBe(409);
	expect((await store.get(run.id)).evidence).toHaveLength(2);
});
