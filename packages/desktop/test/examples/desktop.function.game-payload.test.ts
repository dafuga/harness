import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { gamePayload } from '../../src/validators/development-tooling/gamePayload';

const UNIT_ID = 'desktop.function.game-payload';
const PROJECT_ID = 'local-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const IMAGE_PATH =
	'static/game/checkpoints/abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789.png';
const COMMIT = '0123456789abcdef0123456789abcdef01234567';

type ExampleCase = { name: string; input: unknown } & ({ output: unknown } | { error: unknown });

function recordFor(state: string, cases: ExampleCase[]): void {
	recordExampleCases(
		{ unitId: UNIT_ID, symbol: 'gamePayload', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

function failureOf(run: () => unknown): { name: string; message: string } | undefined {
	try {
		run();
		return undefined;
	} catch (error) {
		return error instanceof Error
			? { name: error.name, message: error.message }
			: { name: 'non-error', message: String(error) };
	}
}

test('Sanitizes a game create request', () => {
	const input = { name: 'coastal-run', kind: 'game', dimension: '2d' };
	const output = gamePayload('game:create', input);

	expect(output).toEqual({ name: 'coastal-run', kind: 'game', dimension: '2d' });

	recordFor('sanitizes-a-game-create-request', [
		{ name: 'create a 2d game', input: { channel: 'game:create', input }, output }
	]);
});

test('Keeps the checkpoint path and commit for an image read', () => {
	const input = { projectId: PROJECT_ID, path: IMAGE_PATH, commit: COMMIT };
	const output = gamePayload('game:image-read', input);

	expect(output).toEqual(input);

	recordFor('keeps-the-checkpoint-path-and-commit-for-an-image-read', [
		{ name: 'read a checkpoint image at a commit', input: { channel: 'game:image-read', input }, output }
	]);
});

test('Rejects a read request with a malformed project id', () => {
	const input = { projectId: 'local-not-hex' };
	const failure = failureOf(() => gamePayload('game:read', input));

	expect(failure).toBeDefined();

	recordFor('rejects-a-read-request-with-a-malformed-project-id', [
		{
			name: 'reject a malformed project id',
			input: { channel: 'game:read', input },
			error: failure
		}
	]);
});
