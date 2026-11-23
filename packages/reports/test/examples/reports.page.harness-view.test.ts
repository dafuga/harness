import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { load } from '../../src/routes/harness/[...view]/+page.server';

function dataFolder(contents?: string) {
	const folder = mkdtempSync(join(tmpdir(), 'harness-view-'));
	if (contents !== undefined) writeFileSync(join(folder, 'index.json'), contents);
	vi.stubEnv('HARNESS_CONSOLE_DATA', folder);
	return folder;
}

test('Resolves an exact explorer address', async () => {
	const folder = dataFolder();
	try {
		const result = await load({ url: new URL('http://localhost/harness/branch/main/pages') });
		expect(result).toEqual({});
		recordExampleCases(
			{
				unitId: 'reports.page.harness-view',
				symbol: 'load',
				state: 'resolves-an-exact-explorer-address',
				evidence: 'examples-cases',
				file: 'resolves-an-exact-explorer-address.json'
			},
			[{ name: 'Exact pages address', input: '/harness/branch/main/pages', output: result }]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(folder, { recursive: true, force: true });
	}
});

test('Resolves when no redirect target exists', async () => {
	const folder = dataFolder('{"branches":[],"revisions":[]}');
	try {
		const result = await load({ url: new URL('http://localhost/harness/nowhere') });
		expect(result).toEqual({});
		recordExampleCases(
			{
				unitId: 'reports.page.harness-view',
				symbol: 'load',
				state: 'resolves-when-no-redirect-target-exists',
				evidence: 'examples-cases',
				file: 'resolves-when-no-redirect-target-exists.json'
			},
			[{ name: 'Unknown address', input: '/harness/nowhere', output: result }]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(folder, { recursive: true, force: true });
	}
});

test('Throws Redirect 308 when the address has a canonical target', async () => {
	const folder = dataFolder(
		'{"branches":[{"name":"main","head":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"revisions":[]}'
	);
	try {
		const caught: unknown = await load({
			url: new URL('http://localhost/harness/branch/main')
		}).catch((error: unknown) => error);
		expect(caught).toMatchObject({ status: 308, location: '/harness/branch/main/pages' });
		const error = caught as { status: number; location: string };
		recordExampleCases(
			{
				unitId: 'reports.page.harness-view',
				symbol: 'load',
				state: 'throws-redirect-308-when-the-address-has-a-canonical-target',
				evidence: 'examples-cases',
				file: 'throws-redirect-308-when-the-address-has-a-canonical-target.json'
			},
			[
				{
					name: 'Branch root canonicalizes',
					input: '/harness/branch/main',
					error: { status: error.status, location: error.location }
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(folder, { recursive: true, force: true });
	}
});

test('Throws SyntaxError when index.json is not valid JSON', async () => {
	const folder = dataFolder('{broken');
	try {
		const error = await load({ url: new URL('http://localhost/harness/branch/main') }).catch(
			(caught: unknown) => caught
		);
		expect(error).toBeInstanceOf(SyntaxError);
		const syntaxError = error as SyntaxError;
		recordExampleCases(
			{
				unitId: 'reports.page.harness-view',
				symbol: 'load',
				state: 'throws-syntaxerror-when-index-json-is-not-valid-json',
				evidence: 'examples-cases',
				file: 'throws-syntaxerror-when-index-json-is-not-valid-json.json'
			},
			[
				{
					name: 'Malformed index',
					input: '{broken',
					error: { name: syntaxError.name, message: syntaxError.message }
				}
			]
		);
	} finally {
		vi.unstubAllEnvs();
		rmSync(folder, { recursive: true, force: true });
	}
});
