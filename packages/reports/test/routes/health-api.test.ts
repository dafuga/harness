import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { ComponentManifest } from '../../../../src/core/development-tooling/unitTypes';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import manifest from '../../../../specification/units/reports.endpoint.api-health.json' with { type: 'json' };
import { GET } from '../../src/routes/api/health/+server';
import { repository } from '../../src/utils/reports-media/reportHttp';

async function responseFor(revision: string | null) {
	const before = process.env.HARNESS_VERIFY_REVISION;
	try {
		if (revision === null) delete process.env.HARNESS_VERIFY_REVISION;
		else process.env.HARNESS_VERIFY_REVISION = revision;
		const response = GET();
		const body = await response.json();
		expect(body.root).toBe(createHash('sha256').update(repository.root).digest('hex'));
		return {
			statusCode: response.status,
			contentType: response.headers.get('content-type'),
			cacheControl: response.headers.get('cache-control'),
			body
		};
	} finally {
		if (before === undefined) delete process.env.HARNESS_VERIFY_REVISION;
		else process.env.HARNESS_VERIFY_REVISION = before;
	}
}

const cases = Object.fromEntries(
	manifest.testing.cases.map((item) => [
		item.id,
		() =>
			measureWorkload('reports.endpoint.api-health', 'health-json-response', () =>
				responseFor(item.input.revision)
			)
	])
);
new TestExpectationService().registerCases(
	test,
	manifest as ComponentManifest,
	'packages/reports/test/routes/health-api.test.ts',
	cases
);
