import { test } from 'vitest';
import { POST } from '../../src/routes/api/report-audio-upload/+server';
import { assertUploadAdmission } from './uploadAdmissionCases';

test('audio uploads reject cross-origin, invalid content type and oversized requests', async () => {
	await assertUploadAdmission(
		(event) => POST(event as Parameters<typeof POST>[0]),
		51000000,
		'Audio upload failed; no evidence was added',
		'audio-upload'
	);
});
