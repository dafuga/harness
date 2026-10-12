import { test, expect } from '@playwright/test';
import { ReportRepository } from '../../src/repositories/ReportRepository';
import { audioFixture } from '../../test/audioFixture';
import { fixtures } from './support/fixtures';
import { expectRetired } from './support/portableReport';

// The form that waited for its client handlers is gone with the report page. What still decides
// whether a selection is accepted is the upload service: it takes a complete request and no other.
test('the upload service accepts a selection only as a complete same-origin multipart request', async ({
	page,
	request,
	baseURL
}) => {
	const store = new ReportRepository(fixtures.reports);
	const run = await store.begin({
		project: fixtures.site('audio-readiness'),
		title: 'Audio upload readiness',
		mode: 'feature',
		environment: 'Requests that are not ready to be accepted'
	});
	await expectRetired(page, '/reports/' + run.id);
	await expect(page.getByRole('combobox', { name: 'Audio upload mode', exact: true })).toHaveCount(
		0
	);
	const audio = { name: 'voice.wav', mimeType: 'audio/wav', buffer: audioFixture() };
	const complete = { reportId: run.id, title: 'Ready recording', audio };
	const post = (path: string, origin: string, multipart: Record<string, unknown>) =>
		request.post(path, { headers: { Origin: origin }, multipart: multipart as never });
	// Another origin, a body that is not a form, and a form without its file are all refused.
	expect((await post('/api/report-audio-upload', 'http://other.invalid', complete)).status()).toBe(
		403
	);
	const plain = await request.post('/api/report-audio-upload', {
		headers: { Origin: baseURL!, 'Content-Type': 'application/json' },
		data: JSON.stringify({ reportId: run.id })
	});
	expect(plain.status()).toBe(415);
	const empty = await post('/api/report-audio-upload', baseURL!, {
		reportId: run.id,
		title: 'No file'
	});
	expect(empty.status()).toBe(400);
	// A pair needs both of its files before either is taken.
	const half = { reportId: run.id, title: 'Half a pair', before: audio };
	expect((await post('/api/report-audio-comparison', baseURL!, half)).status()).toBe(400);
	expect((await store.get(run.id)).evidence).toHaveLength(0);
	// The complete request is the first one that adds anything.
	expect((await post('/api/report-audio-upload', baseURL!, complete)).status()).toBe(201);
	const pair = { reportId: run.id, title: 'Ready pair', before: audio, after: audio };
	expect((await post('/api/report-audio-comparison', baseURL!, pair)).status()).toBe(201);
	expect((await store.get(run.id)).evidence.map((item) => item.phase ?? 'single')).toEqual([
		'single',
		'before',
		'after'
	]);
});
