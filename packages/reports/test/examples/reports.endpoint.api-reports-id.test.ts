import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GET } from '../../src/routes/api/reports/[id]/+server';
import { repository } from '../../src/utils/reports-media/reportHttp';

const report = {
	id: '6f1c2a9e-3b7d-4e2a-9c51-0d8e4b7a2f10',
	project: 'reports',
	state: 'finalized',
	status: 'passed'
};

test('Returns the requested report without caching', async () => {
	const lookup = vi.spyOn(repository, 'get').mockResolvedValue(report as never);
	try {
		const response = await GET({ params: { id: report.id } });
		const body = await response.json();
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(body).toEqual(report);
		recordExampleCases(
			{
				unitId: 'reports.endpoint.api-reports-id',
				symbol: 'GET',
				state: 'returns-the-requested-report-without-caching',
				evidence: 'examples-cases',
				file: 'returns-the-requested-report-without-caching.json'
			},
			[
				{
					name: 'successful lookup returns the report JSON and no-store header',
					input: { params: { id: report.id } },
					output: { status: response.status, headers: { 'Cache-Control': 'no-store' }, body }
				}
			]
		);
	} finally {
		lookup.mockRestore();
	}
});

test('Returns not found when the report lookup fails', async () => {
	const lookup = vi.spyOn(repository, 'get').mockRejectedValue(new Error('missing report'));
	try {
		let failure: unknown;
		try {
			await GET({ params: { id: '0b9d4c71-52e8-4a6f-8d13-7e2c9f05a1b4' } });
		} catch (error) {
			failure = error;
		}
		expect(failure).toMatchObject({ status: 404, body: { message: 'Report not found' } });
		recordExampleCases(
			{
				unitId: 'reports.endpoint.api-reports-id',
				symbol: 'GET',
				state: 'returns-not-found-when-the-report-lookup-fails',
				evidence: 'examples-cases',
				file: 'returns-not-found-when-the-report-lookup-fails.json'
			},
			[
				{
					name: 'missing or inaccessible report lookup becomes the route 404',
					input: { params: { id: '0b9d4c71-52e8-4a6f-8d13-7e2c9f05a1b4' } },
					output: { status: 404, body: { message: 'Report not found' } }
				}
			]
		);
	} finally {
		lookup.mockRestore();
	}
});
