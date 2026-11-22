import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/project-activity/+server';
import { siteActivity } from '../../src/routes/api/project-activity/siteActivity';

vi.mock('../../src/routes/api/project-activity/siteActivity', () => ({
	siteActivity: vi.fn().mockResolvedValue({ activity: [] })
}));

test('Returns repository activity as a no-store JSON response', async () => {
	const response = await GET();
	const body: unknown = await response.json();
	const output = {
		status: response.status,
		cacheControl: response.headers.get('cache-control'),
		body
	};

	expect(response.status).toBe(200);
	expect(response.headers.get('cache-control')).toBe('no-store');
	expect(body).toEqual({ activity: [] });
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-project-activity',
			symbol: 'GET',
			state: 'returns-repository-activity-as-a-no-store-json-response',
			evidence: 'examples-cases',
			file: 'returns-repository-activity-as-a-no-store-json-response.json'
		},
		[
			{
				name: 'a successful repository activity reading is returned with no-store caching',
				input: {},
				output
			}
		]
	);
});

test('Throws Error when site activity rejects', async () => {
	const error = new Error('activity unavailable');
	vi.mocked(siteActivity).mockRejectedValueOnce(error);
	await expect(GET()).rejects.toBe(error);
	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-project-activity',
			symbol: 'GET',
			state: 'throws-error-when-site-activity-rejects',
			evidence: 'examples-cases',
			file: 'throws-error-when-site-activity-rejects.json'
		},
		[
			{
				name: 'a rejection from site activity propagates unchanged',
				input: {},
				error: { name: error.name, message: error.message }
			}
		]
	);
});
