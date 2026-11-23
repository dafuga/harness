import * as Fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const UNIT_ID = 'reports.script.seed-sites';

function meta(state: string) {
	return {
		unitId: UNIT_ID,
		symbol: 'siteRoot',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

/** A script started outside a browser run must be given an e2e root; the temporary one is removed in finally. */
function prepare(root: string): void {
	process.env.HARNESS_E2E_ROOT = root;
	vi.resetModules();
}

function cleanup(root: string): void {
	delete process.env.HARNESS_E2E_ROOT;
	Fs.rmSync(root, { recursive: true, force: true });
}

test('Exposes the alpha and foreign fixture roots', async () => {
	const root = Fs.mkdtempSync(join(tmpdir(), 'seed-sites-'));
	try {
		prepare(root);
		const { siteRoot, foreignRoot } = await import('../../scripts/seed-sites');
		expect(siteRoot).toMatch(/alpha-project$/);
		expect(foreignRoot).toMatch(/beta-project$/);
		expect(foreignRoot).not.toBe(siteRoot);
		recordExampleCases(meta('exposes-the-alpha-and-foreign-fixture-roots'), [
			{
				name: 'alpha root is the alpha fixture',
				input: 'alpha-project',
				output: { endsWithInput: siteRoot.endsWith('alpha-project') }
			},
			{
				name: 'foreign root is the beta fixture and not the alpha root',
				input: 'beta-project',
				output: {
					endsWithInput: foreignRoot.endsWith('beta-project'),
					sameAsAlpha: foreignRoot === siteRoot
				}
			}
		]);
	} finally {
		cleanup(root);
	}
});

test('Throws Error when a filesystem call fails during setup', async () => {
	const root = Fs.mkdtempSync(join(tmpdir(), 'seed-sites-'));
	vi.doMock('node:fs', async () => {
		const actual = await vi.importActual<typeof Fs>('node:fs');
		return {
			...actual,
			rmSync: () => {
				throw new Error('EACCES: permission denied');
			}
		};
	});
	try {
		prepare(root);
		await expect(import('../../scripts/seed-sites')).rejects.toThrow('EACCES: permission denied');
	} finally {
		vi.doUnmock('node:fs');
		vi.resetModules();
		cleanup(root);
	}
	recordExampleCases(meta('throws-error-when-a-filesystem-call-fails-during-setup'), [
		{
			name: 'rmSync fails on the template folder during module execution',
			input: { mocked: 'node:fs rmSync' },
			error: 'Error: EACCES: permission denied'
		}
	]);
});
