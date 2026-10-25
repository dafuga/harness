import { expect, test, vi } from 'vitest';
import contract from '../../../../specification/units/reports.endpoint.api-report-screenshot-upload.json';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';

const upload = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({ put: vi.fn() }));
const fromEnvironment = vi.hoisted(() => vi.fn(() => storage));

vi.mock('../../src/adapters/reports-media/R2ScreenshotStoreAdapter', () => ({
	R2ScreenshotStoreAdapter: { fromEnvironment }
}));
vi.mock('../../src/routes/api/report-screenshot-upload/ScreenshotUploadService', () => ({
	ScreenshotUploadService: class {
		upload = upload;
	}
}));

import { POST } from '../../src/routes/api/report-screenshot-upload/+server';

const check = new TestExpectationService();
const [guards, requests] = contract.testing.cases;
const expected = requests.expected.value as {
	success: object;
	failures: Array<{ message: string; status: number; body: object }>;
	unconfigured: object;
	missing: object;
};
const origin = 'http://127.0.0.1:5588';

function attempt(headers: Record<string, string>, body?: FormData) {
	const request = new Request(origin + '/api/report-screenshot-upload', {
		method: 'POST',
		headers,
		body
	});
	return POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
}

async function inspectError(response: Response) {
	expect(response.headers.get('content-type')).toBe('application/json');
	expect(response.headers.get('cache-control')).toBeNull();
	return { status: response.status, body: await response.json() };
}

test('upload endpoint rejects cross-origin requests before reading files', async () => {
	const requests = guards.input!;
	const outputs = [];
	for (const headers of requests) outputs.push(await inspectError(await attempt(headers)));

	expect(outputs[0].status).toBe(403);
	expect((outputs[0].body as { error: string }).error).toMatch(/same-origin/i);
	check.json(outputs, guards.expected.value);
	expect(fromEnvironment).not.toHaveBeenCalled();
	expect(upload).not.toHaveBeenCalled();
});

test('upload endpoint reports missing R2 configuration clearly', async () => {
	upload.mockReset();
	fromEnvironment.mockReset();
	fromEnvironment.mockReturnValue(storage);
	await assertMissingConfiguration();
	const form = screenshotForm();
	await assertSuccessfulUpload(form);
	await assertMissingFile();
	await assertFailures(form);
});

async function assertMissingConfiguration() {
	for (const name of [
		'PROJECT_REPORTS_R2_ACCOUNT_ID',
		'PROJECT_REPORTS_R2_BUCKET',
		'PROJECT_REPORTS_R2_ACCESS_KEY_ID',
		'PROJECT_REPORTS_R2_SECRET_ACCESS_KEY'
	])
		vi.stubEnv(name, '');
	fromEnvironment.mockImplementationOnce(() => {
		throw new Error('Cloudflare R2 screenshot storage is not configured');
	});
	try {
		const body = new FormData();
		body.set('before', new File(['x'], 'before.png'));
		body.set('after', new File(['x'], 'after.png'));
		const response = await attempt({ Origin: origin }, body);
		expect(response.status).toBe(503);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(response.headers.get('cache-control')).toBeNull();
		const result = await response.json();
		expect(result.error).toMatch(/not configured/);
		check.json(result, expected.unconfigured);
	} finally {
		vi.unstubAllEnvs();
	}
}

function screenshotForm() {
	const form = new FormData();
	for (const [name, value] of Object.entries({
		reportId: 'run-1',
		title: 'Checkout',
		viewport: 'desktop'
	}))
		form.set(name, value);
	form.set('before', new File(['fixture'], 'before.png', { type: 'image/png' }));
	form.set('after', new File(['fixture'], 'after.png', { type: 'image/png' }));
	return form;
}

async function assertSuccessfulUpload(form: FormData) {
	const report = expected.success;
	upload.mockResolvedValueOnce(report);
	const success = await attempt({ Origin: origin }, form);
	expect(success.status).toBe(201);
	expect(success.headers.get('content-type')).toBe('application/json');
	expect(success.headers.get('cache-control')).toBe('no-store');
	check.json(await success.json(), report);
	const [reportId, received] = upload.mock.calls.at(-1)! as [
		string,
		{ title: string; viewport: string; before: File; after: File }
	];
	check.json(
		{
			reportId,
			input: {
				title: received.title,
				viewport: received.viewport,
				before: await fileDetails(received.before),
				after: await fileDetails(received.after)
			}
		},
		{
			reportId: 'run-1',
			input: {
				title: 'Checkout',
				viewport: 'desktop',
				before: { name: 'before.png', type: 'image/png', size: 7, text: 'fixture' },
				after: { name: 'after.png', type: 'image/png', size: 7, text: 'fixture' }
			}
		}
	);
}

async function assertMissingFile() {
	const missing = await attempt({ Origin: origin }, new FormData());
	const missingResult = await inspectError(missing);
	expect(missingResult.status).toBe(400);
	check.json(missingResult.body, expected.missing);
}

async function assertFailures(form: FormData) {
	for (const { message, status, body } of expected.failures) {
		upload.mockRejectedValueOnce(new Error(message));
		const response = await attempt({ Origin: origin }, form);
		const result = await inspectError(response);
		expect(result.status).toBe(status);
		check.json(result.body, body);
	}
}

async function fileDetails(file: File) {
	return { name: file.name, type: file.type, size: file.size, text: await file.text() };
}
