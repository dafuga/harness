import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportSite, ownedBySite } from '../../src/utils/reports-media/reportSite';
import type { ReportSite } from '../../src/utils/reports-media/reportSite.types';

test('Reports site binds checkout and ownership', () => {
	const site: ReportSite = reportSite();
	const project = { path: site.root };
	const ownership = ownedBySite(project);

	expect(site).toMatchObject({ root: expect.any(String), name: expect.any(String) });
	expect(ownership).toBe(true);
	recordExampleCases(
		{
			unitId: 'reports.function.report-site',
			symbol: 'ownedBySite',
			state: 'reports-site-binds-checkout-and-ownership',
			evidence: 'examples-cases',
			file: 'reports-site-binds-checkout-and-ownership.json'
		},
		[
			{
				name: 'the site checkout belongs to its repository',
				input: { site, project },
				output: {
					site: { root: site.root, name: site.name, identity: site.identity },
					owned: ownership
				}
			}
		]
	);
});
