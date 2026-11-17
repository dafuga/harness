import { afterEach, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { LocalDocumentAdapter } from '../../src/adapters/reports-media/LocalDocumentAdapter';

type Document = { items: string[] };
type Counter = { count: number };

const temporaryDirectories: string[] = [];

function makeDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'local-document-'));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function summarizeFailure(
	promise: Promise<unknown>
): Promise<{ name: string; message: string } | null> {
	return promise.then(
		() => null,
		(error: { name?: unknown; message?: unknown }) => ({
			name: String(error.name),
			message: String(error.message)
		})
	);
}

function newDocumentAdapter(file: string | undefined) {
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

test('Keeps the document in memory when no file is set', async () => {
	const adapter = new LocalDocumentAdapter<Counter>(undefined, () => ({ count: 0 }));
	const updated = await adapter.update((counter) => {
		counter.count += 2;
		return counter.count;
	});
	const copy = await adapter.read();
	copy.count = 99;
	const stored = await adapter.read();
	const failure = await summarizeFailure(
		adapter.update((counter) => {
			counter.count = 5;
			(counter as Record<string, unknown>).hook = () => undefined;
			return 'never';
		})
	);
	const afterFailure = await adapter.read();
	expect(updated).toBe(2);
	expect(stored).toEqual({ count: 2 });
	expect(failure?.name).toBe('DataCloneError');
	expect(afterFailure).toEqual({ count: 2 });
	recordExampleCases(
		{
			unitId: 'desktop.adapter.local-document',
			symbol: 'update',
			state: 'keeps-the-document-in-memory-when-no-file-is-set',
			evidence: 'examples-cases',
			file: 'keeps-the-document-in-memory-when-no-file-is-set.json'
		},
		[
			{
				name: 'Memory update adds two and returns the new count',
				input: { file: null, start: 0, increment: 2 },
				output: updated
			},
			{
				name: 'Returned read copy does not change the memory copy',
				input: { file: null, mutateReadCopy: 99 },
				output: stored
			},
			{
				name: 'Uncloneable change rejects and keeps the memory copy',
				input: { file: null, addField: 'function' },
				error: failure
			}
		]
	);
});
