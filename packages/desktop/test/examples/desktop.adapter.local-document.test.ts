import { afterEach, test } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { LocalDocumentAdapter } from '../../src/adapters/reports-media/LocalDocumentAdapter';
import type { Counter } from './desktop.adapter.local-document.test.types';
import {
	temporaryDirectories,
	newDocumentAdapter,
	makeDirectory
} from './desktop.adapter.local-document.cases';

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

function failureOf(promise: Promise<unknown>): Promise<{ name: string; code: unknown } | null> {
	return promise.then(
		() => null,
		(error: { name?: unknown; code?: unknown }) => ({
			name: String(error.name),
			code: error.code ?? null
		})
	);
}

function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
) {
	recordExampleCases(
		{
			unitId: 'desktop.adapter.local-document',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

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

test('Throws DataCloneError when memory change adds a function', async () => {
	const adapter = newDocumentAdapter(undefined);
	const failure = await failureOf(
		adapter.update((document) => {
			(document as Record<string, unknown>).hook = () => undefined;
			return 'never';
		})
	);
	const after = await adapter.read();
	expect(failure?.name).toBe('DataCloneError');
	expect(after).toEqual({ items: [] });
	recordCases('update', 'throws-datacloneerror-when-memory-change-adds-a-function', [
		{
			name: 'Change adds a function to the memory copy',
			input: { file: null, addField: 'function' },
			error: failure
		},
		{
			name: 'Memory copy stays empty after the rejection',
			input: { file: null, operation: 'read' },
			output: after
		}
	]);
});

test('Throws ErrnoException when the document path is a folder', async () => {
	const adapter = newDocumentAdapter(makeDirectory());
	const failure = await failureOf(adapter.update((document) => document.items.length));
	expect(failure).toEqual({ name: 'Error', code: 'EISDIR' });
	recordCases('update', 'throws-errnoexception-when-the-document-path-is-a-folder', [
		{
			name: 'Reading a folder as the document file fails',
			input: { file: 'temporary folder' },
			error: failure
		}
	]);
});

test('Throws SyntaxError when the document file is not JSON', async () => {
	const file = join(makeDirectory(), 'document.json');
	writeFileSync(file, '{"items": [');
	const failure = await failureOf(newDocumentAdapter(file).read());
	expect(failure?.name).toBe('SyntaxError');
	recordCases('read', 'throws-syntaxerror-when-the-document-file-is-not-json', [
		{
			name: 'Truncated JSON file rejects the read',
			input: { file: 'document.json', contents: '{"items": [' },
			error: failure
		}
	]);
});

test('Throws TypeError when the document is circular', async () => {
	const adapter = newDocumentAdapter(join(makeDirectory(), 'nested', 'document.json'));
	const failure = await failureOf(
		adapter.update((document) => {
			(document as Record<string, unknown>).self = document;
			return 'never';
		})
	);
	const after = await adapter.read();
	expect(failure?.name).toBe('TypeError');
	expect(after).toEqual({ items: [] });
	recordCases('update', 'throws-typeerror-when-the-document-is-circular', [
		{
			name: 'Circular change cannot be written as JSON',
			input: { file: 'nested/document.json', addField: 'self' },
			error: failure
		},
		{
			name: 'Document file is not replaced',
			input: { file: 'nested/document.json', operation: 'read' },
			output: after
		}
	]);
});
