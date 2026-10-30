import { test, expect } from '../../../../test/support/browserTest';
import { ReportRepository } from '../../src/repositories/report-repository/ReportRepository';
import { audioFixture } from '../../test/audioFixture';
import { fixtures } from './support/fixtures';
import { expectRetired } from './support/retiredAddress';
// The form of the removed report page posted to this service; the service remains.
test('paired upload validates both originals, attaches phases and protects finalized history', async ({
	page,
	request,
	baseURL
}) => {
	const store = new ReportRepository(fixtures.reports);
	const run = await store.begin({
		project: fixtures.site('upload-pair'),
		title: 'Paired upload review',
		mode: 'feature',
		environment: 'Synthetic transport fixture'
	});
	await expectRetired(page, '/reports/' + run.id);
	const uploaded = await request.post('/api/report-audio-comparison', {
		headers: { Origin: baseURL! },
		multipart: {
			reportId: run.id,
			title: 'Uploaded comparison',
			source: 'Synthetic tone test',
			before: { name: 'before.wav', mimeType: 'audio/wav', buffer: audioFixture(6, 220) },
			after: { name: 'after.wav', mimeType: 'audio/wav', buffer: audioFixture(6, 440) }
		}
	});
	expect(uploaded.status()).toBe(201);
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
