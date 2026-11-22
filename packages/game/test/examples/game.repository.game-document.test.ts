import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { GameDocumentError } from '../../src/repositories/game-authoring/GameDocumentError';
import { GameDocumentRepository } from '../../src/repositories/game-authoring/GameDocumentRepository';

const document = {
	version: 1 as const,
	views: [
		{
			id: 'main',
			title: 'First room',
			dimension: '2d' as const,
			style: 'pixel art',
			checkpoints: []
		}
	],
	mechanics: []
};

function tempDirectory(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

test('Reads a validated game document and its revision', async () => {
	const directory = tempDirectory('game-document-read-');
	const text = JSON.stringify(document, null, '\t') + '\n';
	try {
		writeFileSync(join(directory, 'game.json'), text);
		const result = await new GameDocumentRepository(directory).read();
		expect(result.document).toEqual(document);
		expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
		recordExampleCases(
			{
				unitId: 'game.repository.game-document',
				symbol: 'read',
				state: 'reads-a-validated-game-document-and-its-revision',
				evidence: 'examples-cases',
				file: 'reads-a-validated-game-document-and-its-revision.json'
			},
			[{ name: 'reads the working game document', input: { commit: undefined }, output: result }]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Saves a document when its revision is current', async () => {
	const directory = tempDirectory('game-document-save-');
	const path = join(directory, 'game.json');
	writeFileSync(path, JSON.stringify(document));
	try {
		const repository = new GameDocumentRepository(directory);
		const current = await repository.read();
		const result = await repository.save(document, current.revision);
		const stored = readFileSync(path, 'utf8');
		expect(result.revision).toMatch(/^[a-f0-9]{64}$/);
		expect(stored).toBe(JSON.stringify(document, null, '\t') + '\n');
		recordExampleCases(
			{
				unitId: 'game.repository.game-document',
				symbol: 'save',
				state: 'saves-a-document-when-its-revision-is-current',
				evidence: 'examples-cases',
				file: 'saves-a-document-when-its-revision-is-current.json'
			},
			[
				{
					name: 'replaces the current document and returns its new revision',
					input: { document, expectedRevision: current.revision },
					output: { ...result, stored }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Throws GameDocumentError for a malformed commit', async () => {
	const directory = tempDirectory('game-document-bad-commit-');
	try {
		let caught: unknown;
		try {
			await new GameDocumentRepository(directory).read('not-a-full-commit');
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(GameDocumentError);
		recordExampleCases(
			{
				unitId: 'game.repository.game-document',
				symbol: 'read',
				state: 'throws-gamedocumenterror-for-a-malformed-commit',
				evidence: 'examples-cases',
				file: 'throws-gamedocumenterror-for-a-malformed-commit.json'
			},
			[
				{
					name: 'rejects a commit that is not a full lowercase SHA',
					input: { commit: 'not-a-full-commit' },
					error: { name: 'GameDocumentError', message: 'A full commit is required.' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Throws SyntaxError for malformed game JSON', async () => {
	const directory = tempDirectory('game-document-invalid-json-');
	try {
		writeFileSync(join(directory, 'game.json'), '{');
		let caught: unknown;
		try {
			await new GameDocumentRepository(directory).read();
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(SyntaxError);
		recordExampleCases(
			{
				unitId: 'game.repository.game-document',
				symbol: 'read',
				state: 'throws-syntaxerror-for-malformed-game-json',
				evidence: 'examples-cases',
				file: 'throws-syntaxerror-for-malformed-game-json.json'
			},
			[
				{
					name: 'rejects text that JSON.parse cannot read',
					input: { text: '{' },
					error: { name: 'SyntaxError' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
