import { expect, test, vi } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import manifest from '../../../../specification/units/reports.endpoint.api-report-audio-comparison.json';
const upload = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/reports-media/AudioUploadService', () => ({
	AudioUploadService: class {
		uploadComparison = upload;
	}
}));
import { POST } from '../../src/routes/api/report-audio-comparison/+server';
const contract = (manifest as ComponentManifest).testing!.cases[0];
const check = new TestExpectationService();
const origin = 'http://127.0.0.1:5588';
function attempt(headers: Record<string, string>, body?: FormData) {
	const request = new Request(origin + '/api/report-audio-comparison', {
		method: 'POST',
		headers,
		body
	});
	return POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
}
test('paired audio uploads reject cross-origin, invalid content type and oversized requests', async () => {
	const outputs = [];
	for (const headers of contract.input as Array<Record<string, string>>) {
		const response = await attempt(headers);
		outputs.push({ status: response.status, body: await response.json() });
	}
	check.json(outputs, contract.expected!.kind === 'json' ? contract.expected!.value : null);
	const form = await successfulUpload();
	const missing = await attempt({ Origin: origin }, new FormData());
	expect(missing.status).toBe(400);
	check.json(await missing.json(), { error: 'Choose Before and After audio files' });
	for (const [message, status, error] of [
		['Report finalized', 409, 'Report finalized'],
		['ENOENT', 404, 'Report not found'],
		['Invalid audio format', 400, 'Invalid audio format'],
		['Storage unavailable', 500, 'Audio comparison upload failed; no evidence was added']
	] as const) {
		upload.mockRejectedValueOnce(new Error(message));
		const response = await attempt({ Origin: origin }, form);
		expect(response.status).toBe(status);
		check.json(await response.json(), { error });
	}
});

async function successfulUpload(): Promise<FormData> {
	const form = new FormData();
	for (const [name, value] of Object.entries({
		reportId: 'run-1',
		title: 'A clip',
		note: 'Fixture',
		source: 'Unit fixture'
	}))
		form.set(name, value);
	const files = ['before', 'after'];
	for (const name of files)
		form.set(name, new File(['fixture'], name + '.wav', { type: 'audio/wav' }));
	const report = { id: 'run-1', evidence: [{ id: 'clip-1', title: 'A clip' }] };
	upload.mockResolvedValue(report);
	const success = await attempt({ Origin: origin }, form);
	expect(success.status).toBe(201);
	expect(success.headers.get('cache-control')).toBe('no-store');
	check.json(await success.json(), report);
	const [reportId, received] = upload.mock.calls.at(-1)! as [string, Record<string, unknown>];
	const payload = { ...received };
	const expectedPayload: Record<string, unknown> = {
		title: 'A clip',
		note: 'Fixture',
		source: 'Unit fixture'
	};
	for (const name of files) {
		const file = received[name] as File;
		payload[name] = { name: file.name, type: file.type, size: file.size, text: await file.text() };
		expectedPayload[name] = { name: name + '.wav', type: 'audio/wav', size: 7, text: 'fixture' };
	}
	check.json({ reportId, payload }, { reportId: 'run-1', payload: expectedPayload });
	return form;
}
