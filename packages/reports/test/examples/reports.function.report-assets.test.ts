import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { reportAssets } from '../../src/repositories/reports-media/report-repository/reportAssets';
import { InvalidEvidenceSourceError } from '../../src/repositories/reports-media/report-repository/reportAssets.types';
import { imageAsset, registeredAsset, writeImageAsset } from '../../src/utils/reports-media/reportAssets';
import { InvalidAssetError } from '../../src/utils/reports-media/reportAssets.types';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function temporaryDirectory(prefix: string) {
	return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

test('Image signatures produce content-addressed metadata', () => {
	const output = imageAsset(png, 'evidence.png');
	expect(output).toEqual({
		name: `${createHash('sha256').update(png).digest('hex')}.png`,
		mime: 'image/png'
	});
	recordExampleCases(
		{
			unitId: 'reports.function.report-assets',
			symbol: 'imageAsset',
			state: 'image-signatures-produce-content-addressed-metadata',
			evidence: 'examples-cases',
			file: 'image-signatures-produce-content-addressed-metadata.json'
		},
		[{ name: 'PNG signature and matching filename', input: { filename: 'evidence.png', bytes: [...png] }, output }]
	);
});

test('Image writes create the assets folder with supplied bytes', async () => {
	const root = temporaryDirectory('write-report-asset');
	try {
		const name = 'content-addressed.png';
		await writeImageAsset(root, name, png);
		const output = readFileSync(join(root, 'assets', name));
		expect(output).toEqual(png);
		recordExampleCases(
			{
				unitId: 'reports.function.report-assets',
				symbol: 'writeImageAsset',
				state: 'image-writes-create-the-assets-folder-with-supplied-bytes',
				evidence: 'examples-cases',
				file: 'image-writes-create-the-assets-folder-with-supplied-bytes.json'
			},
			[{ name: 'PNG bytes stored beneath assets', input: { directory: root, name, bytes: [...png] }, output: { path: 'assets/content-addressed.png', bytes: [...output] } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Report image evidence is stored and returned as metadata', async () => {
	const root = temporaryDirectory('report-assets');
	try {
		const source = join(root, 'evidence.png');
		const destination = join(root, 'report');
		writeFileSync(source, png);
		const output = await reportAssets(destination, source);
		expect(output).toEqual({ name: imageAsset(png, source).name, mediaType: 'image', mimeType: 'image/png' });
		expect(readFileSync(join(destination, 'assets', output.name))).toEqual(png);
		recordExampleCases(
			{
				unitId: 'reports.function.report-assets',
				symbol: 'reportAssets',
				state: 'report-image-evidence-is-stored-and-returned-as-metadata',
				evidence: 'examples-cases',
				file: 'report-image-evidence-is-stored-and-returned-as-metadata.json'
			},
			[{ name: 'valid PNG evidence file', input: { directory: destination, source }, output: { ...output } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Report evidence rejects a directory source', async () => {
	const root = temporaryDirectory('invalid-report-evidence');
	try {
		await expect(reportAssets(join(root, 'report'), root)).rejects.toBeInstanceOf(InvalidEvidenceSourceError);
		recordExampleCases(
			{
				unitId: 'reports.function.report-assets',
				symbol: 'reportAssets',
				state: 'report-evidence-rejects-a-directory-source',
				evidence: 'examples-cases',
				file: 'report-evidence-rejects-a-directory-source.json'
			},
			[{ name: 'directory is not an evidence file', input: { directory: join(root, 'report'), source: root }, error: { name: 'InvalidEvidenceSourceError', message: 'Invalid evidence file or size' } }]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Registered assets resolve only listed local files', async () => {
	const root = temporaryDirectory('registered-assets');
	try {
		const name = 'asset.png';
		writeFileSync(join(root, name), png);
		const output = await registeredAsset(root, name, [name]);
		expect(output).toBe(join(realpathSync(root), name));
		await expect(registeredAsset(root, 'missing.png', [name])).rejects.toBeInstanceOf(InvalidAssetError);
		recordExampleCases(
			{
				unitId: 'reports.function.report-assets',
				symbol: 'registeredAsset',
				state: 'registered-assets-resolve-only-listed-local-files',
				evidence: 'examples-cases',
				file: 'registered-assets-resolve-only-listed-local-files.json'
			},
			[
				{ name: 'listed local file', input: { directory: root, name, registered: [name] }, output },
				{ name: 'unlisted file rejected', input: { directory: root, name: 'missing.png', registered: [name] }, error: { name: 'InvalidAssetError', message: 'Unregistered asset' } }
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
