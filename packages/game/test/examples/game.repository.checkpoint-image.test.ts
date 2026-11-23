import type { Cases } from './game.repository.checkpoint-image.test.types';
import { Buffer } from 'node:buffer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { CheckpointImageError } from '../../src/repositories/game-authoring/CheckpointImageError';
import { CheckpointImageRepository } from '../../src/repositories/game-authoring/CheckpointImageRepository';

const UNIT = 'game.repository.checkpoint-image';
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG = Buffer.from(PNG_BASE64, 'base64');
const DATA_URL = 'data:image/png;base64,' + PNG_BASE64;
const ZERO_PATH = 'static/game/checkpoints/' + '0'.repeat(64) + '.png';
const UPPER_PATH = 'static/game/checkpoints/' + 'A'.repeat(64) + '.png';
const OUTSIDE_PATH = 'static/game/notes.png';
const SAVED_PATTERN = /^static\/game\/checkpoints\/[a-f0-9]{64}\.png$/;

async function withRoot(run: (root: string) => Promise<void>): Promise<void> {
	const root = mkdtempSync(join(tmpdir(), 'checkpoint-image-'));
	try {
		await run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

async function rejection(work: () => Promise<unknown>): Promise<{ name: string; message: string }> {
	try {
		await work();
	} catch (error) {
		expect(error).toBeInstanceOf(CheckpointImageError);
		return { name: (error as Error).name, message: (error as Error).message };
	}
	throw new Error('Expected the checkpoint image call to reject.');
}

function record(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: state + '.json' },
		cases
	);
}

test('Saves PNG bytes under their SHA-256 name', async () => {
	await withRoot(async (root) => {
		const repository = new CheckpointImageRepository(root);
		const first = await repository.save(PNG);
		const second = await repository.save(PNG);

		expect(first).toMatch(SAVED_PATTERN);
		expect(second).toBe(first);
		record('saves-png-bytes-under-their-sha-256-name', 'save', [
			{
				name: 'first save writes the PNG and returns its hash path',
				input: { bytes: PNG_BASE64 },
				output: first
			},
			{
				name: 'second save of the same bytes returns the same path',
				input: { bytes: PNG_BASE64 },
				output: second
			}
		]);
	});
});

test('Reads a saved image back as a data URL', async () => {
	await withRoot(async (root) => {
		const repository = new CheckpointImageRepository(root);
		const path = await repository.save(PNG);
		const url = await repository.read(path);

		expect(url).toBe(DATA_URL);
		record('reads-a-saved-image-back-as-a-data-url', 'read', [
			{ name: 'reads the saved working-tree image as a PNG data URL', input: { path }, output: url }
		]);
	});
});

test('Rejects checkpoint paths outside the image pattern', async () => {
	await withRoot(async (root) => {
		const repository = new CheckpointImageRepository(root);
		const outside = await rejection(() => repository.read(OUTSIDE_PATH));
		const upper = await rejection(() => repository.read(UPPER_PATH));

		expect(outside.message).toBe('Invalid checkpoint image path.');
		expect(upper.message).toBe('Invalid checkpoint image path.');
		record('rejects-checkpoint-paths-outside-the-image-pattern', 'read', [
			{
				name: 'a path outside static/game/checkpoints is refused',
				input: { path: OUTSIDE_PATH },
				error: outside
			},
			{ name: 'an uppercase hex file name is refused', input: { path: UPPER_PATH }, error: upper }
		]);
	});
});

test('Rejects a commit that is not a full lowercase SHA', async () => {
	await withRoot(async (root) => {
		const repository = new CheckpointImageRepository(root);
		const short = await rejection(() => repository.read(ZERO_PATH, 'abc1234'));
		const upper = await rejection(() => repository.read(ZERO_PATH, 'A'.repeat(40)));

		expect(short.message).toBe('A full commit is required.');
		expect(upper.message).toBe('A full commit is required.');
		record('rejects-a-commit-that-is-not-a-full-lowercase-sha', 'read', [
			{
				name: 'a short commit is refused before git runs',
				input: { path: ZERO_PATH, commit: 'abc1234' },
				error: short
			},
			{
				name: 'an uppercase 40-character commit is refused',
				input: { path: ZERO_PATH, commit: 'A'.repeat(40) },
				error: upper
			}
		]);
	});
});

test('Rejects an image whose bytes do not match its file name', async () => {
	await withRoot(async (root) => {
		mkdirSync(join(root, 'static/game/checkpoints'), { recursive: true });
		writeFileSync(join(root, ZERO_PATH), PNG);
		const repository = new CheckpointImageRepository(root);
		const failure = await rejection(() => repository.read(ZERO_PATH));

		expect(failure.message).toBe('Checkpoint image integrity failed.');
		record('rejects-an-image-whose-bytes-do-not-match-its-file-name', 'read', [
			{
				name: 'a PNG stored under the wrong hash name is refused',
				input: { path: ZERO_PATH },
				error: failure
			}
		]);
	});
});
