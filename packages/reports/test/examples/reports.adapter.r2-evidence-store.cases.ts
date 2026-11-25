import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { evidenceObjectKey } from '../../src/adapters/reports-media/R2EvidenceStoreAdapter';

export const REPORT = '5b0e7c3a-9f2d-4c8e-8a1b-6d3f2e1c0b9a';
export const PNG = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824.png';
const WEBP = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855.webp';

test('Builds evidence object keys under the run folder', () => {
	const png = evidenceObjectKey(REPORT, PNG);
	const webp = evidenceObjectKey(REPORT, WEBP);
	expect(png).toBe(`report-evidence/runs/${REPORT}/assets/${PNG}`);
	expect(webp).toBe(`report-evidence/runs/${REPORT}/assets/${WEBP}`);
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-evidence-store',
			symbol: 'evidenceObjectKey',
			state: 'builds-evidence-object-keys-under-the-run-folder',
			evidence: 'examples-cases',
			file: 'builds-evidence-object-keys-under-the-run-folder.json'
		},
		[
			{ name: 'png evidence key', input: { reportId: REPORT, file: PNG }, output: png },
			{ name: 'webp evidence key', input: { reportId: REPORT, file: WEBP }, output: webp }
		]
	);
});
