import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { legacyReport } from '../../src/cli/program/legacy-import-service/legacyReport';

const complete = {
	id: 'run-20261102-0931a',
	project: { id: 'prj-7f3c', name: 'storefront-web', path: '/repos/storefront-web' },
	title: 'Checkout visual check',
	mode: 'ci',
	environment: 'staging',
	revision: '  3a7f9c2e4b1d86f05e9a2c7b4d1f8e6a0c3b5d72  ',
	startedAt: '2026-11-02T09:31:02.114Z',
	updatedAt: '2026-11-02T09:33:47.902Z',
	summary: '2 of 2 checks passed.',
	status: 'passed',
	state: 'archived',
	checks: [
		{ id: 'visual-diff', title: 'Visual diff', status: 'passed', ignored: true },
		{ id: 'a11y-scan', title: 'Accessibility scan', status: 'passed' }
	],
	evidence: [{
		id: 'ev-0001', title: 'Checkout on mobile',
		file: 'reports/2026-11-02/checkout-mobile.png', status: 'passed',
		mimeType: 'image/png', mediaType: 'image/fallback',
		capturedAt: '2026-11-02T09:32:15.000Z', viewport: '390x844'
	}]
};

const minimal = {
	id: 'run-20261030-1407b',
	project: { id: 'prj-7f3c', name: '', path: '/repos/storefront-web' },
	title: 'Login smoke run', mode: 'local', environment: 'local',
	startedAt: '2026-10-30T14:07:55.480Z',
	updatedAt: '2026-10-30T14:08:10.012Z', status: 'running', state: 'active'
};

test('Normalizes legacy manifests and rejects invalid records', () => {
	const normalized = legacyReport(complete);
	const running = legacyReport(minimal);
	const invalid = legacyReport({ ...minimal, evidence: [{ id: '', file: 'x', status: 'passed' }] });
	expect(normalized?.record).toMatchObject({
		schemaVersion: 1, kind: 'legacy-report', project: 'storefront-web',
		status: 'passed', state: 'archived',
		revision: '3a7f9c2e4b1d86f05e9a2c7b4d1f8e6a0c3b5d72',
		checks: [{ id: 'visual-diff', title: 'Visual diff', status: 'passed' }, { id: 'a11y-scan', title: 'Accessibility scan', status: 'passed' }],
		media: [{ id: 'ev-0001', mediaType: 'image/png', provenance: 'legacy-report', sha256: null, bytes: null }]
	});
	expect(running?.record).toMatchObject({ project: 'prj-7f3c', status: 'running', revision: null, summary: '', checks: [], media: [] });
	expect(invalid).toBeUndefined();
	const summary = (value: ReturnType<typeof legacyReport>) => value && ({ project: value.project, record: value.record });
	recordExampleCases(
		{ unitId: 'function.legacy-report', symbol: 'legacyReport', state: 'normalizes-legacy-manifests-and-rejects-invalid-records', evidence: 'examples-cases', file: 'normalizes-legacy-manifests-and-rejects-invalid-records.json' },
		[
			{ name: 'valid archived report keeps status and normalized evidence', input: complete, output: summary(normalized) },
			{ name: 'minimal running report defaults optional collections', input: minimal, output: summary(running) },
			{ name: 'evidence without an id is rejected', input: { ...minimal, evidence: [{ id: '', file: 'x', status: 'passed' }] }, output: invalid }
		]
	);
});
