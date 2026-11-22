import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { siteActivity } from '../../src/routes/api/project-activity/siteActivity';

type SiteActivityResult = Awaited<ReturnType<typeof siteActivity>>;

/** Reduces the site read to the fields that matter, without repository details. */
function summarise(shown: SiteActivityResult): {
	available: boolean;
	hasActivity: boolean;
	hasLive: boolean;
} {
	if (shown === undefined) {
		return { available: false, hasActivity: false, hasLive: false };
	}
	return {
		available: true,
		hasActivity: 'activity' in shown,
		hasLive: 'live' in shown
	};
}

/**
 * Reads the site with its root set to an empty temporary folder that is not a Git repository,
 * so the read stays bounded and never walks the real repository. The override is removed after.
 */
async function readEmptySite(directory: string): Promise<SiteActivityResult> {
	process.env.HARNESS_SITE_ROOT = directory;
	try {
		return await siteActivity();
	} finally {
		delete process.env.HARNESS_SITE_ROOT;
	}
}

test('Hosted site activity is read or reported unavailable', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'site-activity-'));
	try {
		const summary = summarise(await readEmptySite(directory));

		expect(summary.hasActivity).toBe(summary.available);
		expect(summary.hasLive).toBe(summary.available);
		recordExampleCases(
			{
				unitId: 'reports.function.site-activity',
				symbol: 'siteActivity',
				state: 'hosted-site-activity-is-read-or-reported-unavailable',
				evidence: 'examples-cases',
				file: 'hosted-site-activity-is-read-or-reported-unavailable.json'
			},
			[
				{
					name: 'site root is an empty folder outside Git',
					input: { siteRoot: 'empty-directory' },
					output: summary
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
