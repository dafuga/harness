import type { Cases, Kind } from './template.pieces.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { pieceFiles } from '../../src/templates/development-tooling/pieces';
import type { PieceContext } from '../../src/templates/development-tooling/pieces.types';

const UTIL_STATE = 'plans-a-util-file-from-a-piece-name';
const MIGRATION_STATE = 'plans-a-migration-whose-comment-copies-the-name';
const KIND_STATE = 'throws-typeerror-for-a-kind-outside-the-scaffold-list';
const DIMENSION_STATE = 'rejects-a-game-view-without-a-dimension';
const TIER_STATE = 'marks-an-organism-svelte-file-with-its-tier';

const MIGRATION_CONTENTS =
	'-- add invoice status\n-- Keep migrations small and reversible when the database supports it.\n';
const DIMENSION_MESSAGE = 'A game view needs harness.dimension 2d or 3d in package.json.';

function recordState(state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'template.pieces',
			symbol: 'pieceFiles',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function catchError(run: () => unknown): Error {
	try {
		run();
	} catch (caught) {
		return caught as Error;
	}
	throw new Error('expected the call to throw');
}

test('Plans a util file from a piece name', () => {
	const files = pieceFiles('util', 'invoice line');
	const paths = files.map((file) => file.path);

	expect(paths.some((path) => path.startsWith('src/utils/'))).toBe(true);
	expect(files.every((file) => file.contents.length > 0)).toBe(true);
	recordState(UTIL_STATE, [
		{
			name: 'util kind with a two-word name',
			input: { kind: 'util', name: 'invoice line' },
			output: { paths }
		}
	]);
});

test('Plans a migration whose comment copies the name', () => {
	const found = pieceFiles('migration', 'add invoice status').find(
		(file) => file.path === 'db/migrations/add-invoice-status.sql'
	);

	expect(found).toBeDefined();
	expect(found?.contents).toBe(MIGRATION_CONTENTS);
	recordState(MIGRATION_STATE, [
		{
			name: 'migration kind copies the name into the SQL comment',
			input: { kind: 'migration', name: 'add invoice status' },
			output: { path: found?.path, contents: found?.contents }
		}
	]);
});

test('Throws TypeError for a kind outside the scaffold list', () => {
	const error = catchError(() => pieceFiles('not-a-kind' as Kind, 'invoice line'));

	expect(error).toBeInstanceOf(TypeError);
	recordState(KIND_STATE, [
		{
			name: 'unknown kind has no builder and throws',
			input: { kind: 'not-a-kind', name: 'invoice line' },
			error: { name: error.name, message: error.message }
		}
	]);
});

test('Rejects a game view without a dimension', () => {
	const error = catchError(() => pieceFiles('game-view', 'arena'));

	expect(error.message).toBe(DIMENSION_MESSAGE);
	recordState(DIMENSION_STATE, [
		{
			name: 'game-view without context dimension throws the CLI message',
			input: { kind: 'game-view', name: 'arena', context: {} },
			error: { name: error.name, message: error.message }
		}
	]);
});

test('Marks an organism svelte file with its tier', () => {
	const context: PieceContext = { level: 'organism' };
	const svelte = pieceFiles('component', 'invoice line', context).find((file) =>
		file.path.endsWith('.svelte')
	);

	expect(svelte).toBeDefined();
	expect(svelte?.contents).toContain('organism');
	recordState(TIER_STATE, [
		{
			name: 'component with organism level writes the tier into the svelte header',
			input: { kind: 'component', name: 'invoice line', context },
			output: { path: svelte?.path, header: svelte?.contents.split('\n').slice(0, 3) }
		}
	]);
});
