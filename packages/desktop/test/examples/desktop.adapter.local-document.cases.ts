import { test } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { LocalDocumentAdapter } from '../../src/adapters/reports-media/LocalDocumentAdapter';
import type { Document } from './desktop.adapter.local-document.test.types';

export const temporaryDirectories: string[] = [];

export function makeDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'local-document-'));
	temporaryDirectories.push(directory);
	return directory;
}

export function newDocumentAdapter(file: string | undefined) {
	return new LocalDocumentAdapter<Document>(file, () => ({ items: [] }));
}

test('Reads and updates a document file under a new folder', async () => {
	const file = join(makeDirectory(), 'nested', 'reports', 'document.json');
	const adapter = newDocumentAdapter(file);
	const initial = await adapter.read();
	const count = await adapter.update((document) => {
		document.items.push('draft-report');
		return document.items.length;
	});
	const stored = await adapter.read();
	const reopened = await newDocumentAdapter(file).read();
	expect(initial).toEqual({ items: [] });
	expect(count).toBe(1);
	expect(stored).toEqual({ items: ['draft-report'] });
	expect(reopened).toEqual(stored);
	recordExampleCases(
		{
			unitId: 'desktop.adapter.local-document',
			symbol: 'update',
			state: 'reads-and-updates-a-document-file-under-a-new-folder',
			evidence: 'examples-cases',
			file: 'reads-and-updates-a-document-file-under-a-new-folder.json'
		},
		[
			{
				name: 'Missing file reads the empty document',
				input: { file: 'nested/reports/document.json', operation: 'read' },
				output: initial
			},
			{
				name: 'Update appends a draft and returns the new count',
				input: { operation: 'update', change: 'push draft-report' },
				output: count
			},
			{
				name: 'Reopening the file returns the written document',
				input: { file: 'nested/reports/document.json', operation: 'read' },
				output: reopened
			}
		]
	);
});
