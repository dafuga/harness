import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/reports/+server';
import { repository } from '../../src/utils/reports-media/reportHttp';

test('Lists reports without caching the response', async () => {
	const response = await GET();
	const body: unknown = await response.json();

	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(Array.isArray(body)).toBe(true);

	recordExampleCases(
		{
			unitId: 'reports.endpoint.api-reports',
			symbol: 'GET',
			state: 'lists-reports-without-caching-the-response',
			evidence: 'examples-cases',
			file: 'lists-reports-without-caching-the-response.json'
		},
		[
			{
				name: 'GET returns a JSON report list with no-store caching',
				input: {},
				output: {
					status: response.status,
					cacheControl: response.headers.get('Cache-Control'),
					bodyIsArray: Array.isArray(body)
				}
			}
		]
	);
});

test('Throws repository.list rejection when it fails', async () => {
	const rejection = new Error('Example repository failure');
	const list = vi.spyOn(repository, 'list').mockRejectedValue(rejection);

	try {
		await expect(GET()).rejects.toBe(rejection);
		recordExampleCases(
			{
				unitId: 'reports.endpoint.api-reports',
				symbol: 'GET',
				state: 'throws-repository-list-rejection-when-it-fails',
				evidence: 'examples-cases',
				file: 'throws-repository-list-rejection-when-it-fails.json'
			},
			[
				{
					name: 'GET propagates repository.list rejection',
					input: { rejectionMessage: rejection.message },
					error: { message: rejection.message }
				}
			]
		);
	} finally {
		list.mockRestore();
	}
});
