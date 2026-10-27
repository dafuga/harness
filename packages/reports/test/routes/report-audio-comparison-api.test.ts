import { test, vi } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import manifest from '../../../../specification/units/reports.endpoint.api-report-audio-comparison.json' with { type: 'json' };

const upload = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/reports-media/AudioUploadService', () => ({
	AudioUploadService: class {
		uploadComparison = upload;
	}
}));
import { POST } from '../../src/routes/api/report-audio-comparison/+server';

const contract = manifest.testing.cases[0];
const check = new TestExpectationService();
const origin = 'http://127.0.0.1:5588';

async function attempt(row: {
	name: string;
	headers: Record<string, string>;
	form?: Record<string, string | { name: string; type: string; text: string }>;
	service?: { report?: unknown; error?: string };
	rawBody?: string;
}) {
	upload.mockReset();
	if (row.service?.error) upload.mockRejectedValue(new Error(row.service.error));
	else if (row.service && 'report' in row.service) upload.mockResolvedValue(row.service.report);
	let body: FormData | string | undefined = row.rawBody;
	if (row.form) {
		const form = new FormData();
		for (const [key, value] of Object.entries(row.form))
			form.set(key, typeof value === 'string' ? value : new File([value.text], value.name, value));
		body = form;
	}
	const request = new Request(origin + '/api/report-audio-comparison', {
		method: 'POST',
		headers: row.headers,
		body
	});
	const response = await POST({ request, url: new URL(request.url) } as Parameters<typeof POST>[0]);
	return {
		name: row.name,
		status: response.status,
		contentType: response.headers.get('content-type'),
		cacheControl: response.headers.get('cache-control'),
		body: await response.json(),
		calls: await uploadCalls()
	};
}

async function uploadCalls() {
	return Promise.all(
		upload.mock.calls.map(async (call) => {
			const [reportId, received] = call as [string, Record<string, unknown>];
			const payload: Record<string, unknown> = { ...received };
			for (const name of ['before', 'after']) {
				const file = received[name] as File;
				payload[name] = {
					name: file.name,
					type: file.type,
					size: file.size,
					text: await file.text()
				};
			}
			return { reportId, payload };
		})
	);
}

check.registerCases(
	test,
	manifest as unknown as ComponentManifest,
	'packages/reports/test/routes/report-audio-comparison-api.test.ts',
	{
		'request-matrix': () =>
			measureWorkload(
				'reports.endpoint.api-report-audio-comparison',
				'paired-audio-response-matrix',
				async () => {
					const observed = [];
					for (const row of contract.input as unknown as Parameters<typeof attempt>[0][])
						observed.push(await attempt(row));
					check.json(observed, contract.expected.value);
					return observed;
				}
			)
	}
);
