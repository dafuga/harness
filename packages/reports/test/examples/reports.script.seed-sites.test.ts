import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const alphaInput = 'alpha-project';
const foreignInput = 'beta-project';

/** The script builds its fixtures when loaded, so load it with a temporary run root. */
async function loadSeedSites(runRoot: string) {
	vi.stubEnv('HARNESS_E2E_ROOT', runRoot);
	try {
		return await import('../../scripts/seed-sites');
	} finally {
		vi.unstubAllEnvs();
	}
}

test('Exposes the alpha and foreign fixture roots', async () => {
	const runRoot = mkdtempSync(join(tmpdir(), 'seed-sites-'));
	try {
		const { siteRoot, foreignRoot } = await loadSeedSites(runRoot);
		expect(siteRoot.endsWith(alphaInput)).toBe(true);
		expect(foreignRoot.endsWith(foreignInput)).toBe(true);
		expect(foreignRoot).not.toBe(siteRoot);

		recordExampleCases(
			{
				unitId: 'reports.script.seed-sites',
				symbol: 'siteRoot',
				state: 'exposes-the-alpha-and-foreign-fixture-roots',
				evidence: 'examples-cases',
				file: 'exposes-the-alpha-and-foreign-fixture-roots.json'
			},
			[
				{
					name: 'alpha fixture root',
					input: alphaInput,
					output: siteRoot.replace(runRoot, '<run-root>')
				},
				{
					name: 'foreign fixture root',
					input: foreignInput,
					output: foreignRoot.replace(runRoot, '<run-root>')
				}
			]
		);
	} finally {
		rmSync(runRoot, { recursive: true, force: true });
	}
});
