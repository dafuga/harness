import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { holds } from '../../scripts/ios-scan-fixture';

function productWithFiles(files: Record<string, string>): string {
	const folder = mkdtempSync(join(tmpdir(), 'ios-scan-fixture-'));
	for (const [name, value] of Object.entries(files)) {
		const file = join(folder, name);
		mkdirSync(join(file, '..'), { recursive: true });
		writeFileSync(file, value);
	}
	return folder;
}

test('finds literal scanner markers in product files', () => {
	const matched = productWithFiles({ 'App/Scanner.swift': 'SyntheticScanner enabled' });
	const missed = productWithFiles({ 'App/Scanner.swift': 'RemoteCameraScanner' });
	try {
		const synthetic = holds(matched, 'SyntheticScanner');
		const remote = holds(missed, 'SyntheticScanner');
		expect(synthetic).toBe(true);
		expect(remote).toBe(false);
		recordExampleCases(
			{
				unitId: 'desktop.script.ios-scan-fixture',
				symbol: 'holds',
				state: 'finds-literal-scanner-markers-in-product-files',
				evidence: 'examples-cases',
				file: 'finds-literal-scanner-markers-in-product-files.json'
			},
			[
				{
					name: 'synthetic marker is present',
					input: { product: matched, words: 'SyntheticScanner' },
					output: synthetic
				},
				{
					name: 'different scanner marker is absent',
					input: { product: missed, words: 'SyntheticScanner' },
					output: remote
				}
			]
		);
	} finally {
		rmSync(matched, { recursive: true, force: true });
		rmSync(missed, { recursive: true, force: true });
	}
});

test('Throws Error when product files cannot be read', () => {
	const product = mkdtempSync(join(tmpdir(), 'ios-scan-fixture-error-'));
	rmSync(product, { recursive: true, force: true });
	let error: unknown;
	try {
		holds(product, 'SyntheticScanner');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-scan-fixture',
			symbol: 'holds',
			state: 'throws-error-when-product-files-cannot-be-read',
			evidence: 'examples-cases',
			file: 'throws-error-when-product-files-cannot-be-read.json'
		},
		[
			{
				name: 'missing product directory propagates the read error',
				input: { product, words: 'SyntheticScanner' },
				error: { name: 'Error' }
			}
		]
	);
});
