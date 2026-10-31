import { test } from 'vitest';
import { POST } from '../../src/routes/api/report-audio-comparison/+server';
import { assertUploadAdmission } from './uploadAdmissionCases';

test('paired audio uploads reject cross-origin, invalid content type and oversized requests', async () => {
	await assertUploadAdmission(
		(event) => POST(event as Parameters<typeof POST>[0]),
		101000000,
		'Audio comparison upload failed; no evidence was added',
		'audio-comparison'
	);
});
