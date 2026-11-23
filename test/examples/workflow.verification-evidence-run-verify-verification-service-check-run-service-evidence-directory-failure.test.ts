import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { evidenceDirectoryFailure } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/evidenceDirectoryFailure';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const UNIT_ID =
	'workflow.verification-evidence-run-verify-verification-service-check-run-service-evidence-directory-failure';
const FAILURE = 'capture directory ancestry must contain regular directories beneath the run root';

function meta(state: string, file: string) {
	return {
		unitId: UNIT_ID,
		symbol: 'evidenceDirectoryFailure',
		state,
		evidence: 'examples-cases',
		file
	};
}

test('Accepts a nested evidence directory that does not exist yet', async () => {
	await withTempDir('evidence-ancestry-missing-', (directory) => {
		const root = join(directory, 'run');
		mkdirSync(root);
		const failure = evidenceDirectoryFailure(join(root, 'evidence', 'captures'), root);

		expect(failure).toBeUndefined();
		recordExampleCases(
			meta(
				'accepts-a-nested-evidence-directory-that-does-not-exist-yet',
				'accepts-a-nested-evidence-directory-that-does-not-exist-yet.json'
			),
			[
				{
					name: 'missing nested directory beneath the run root reports no failure',
					input: { directory: 'run/evidence/captures', root: 'run' },
					output: { failure: failure ?? null }
				}
			]
		);
	});
});

test('Rejects a symlink component beneath the run root', async () => {
	await withTempDir('evidence-ancestry-symlink-', (directory) => {
		const root = join(directory, 'run');
		mkdirSync(join(root, 'real'), { recursive: true });
		symlinkSync(join(root, 'real'), join(root, 'linked'));
		const failure = evidenceDirectoryFailure(join(root, 'linked', 'captures'), root);

		expect(failure).toBe(FAILURE);
		recordExampleCases(
			meta(
				'rejects-a-symlink-component-beneath-the-run-root',
				'rejects-a-symlink-component-beneath-the-run-root.json'
			),
			[
				{
					name: 'symlinked component beneath the run root returns the ancestry failure',
					input: { directory: 'run/linked/captures', root: 'run' },
					output: { failure }
				}
			]
		);
	});
});

test('Rejects a sibling directory outside the run root', async () => {
	await withTempDir('evidence-ancestry-outside-', (directory) => {
		const root = join(directory, 'run');
		mkdirSync(root);
		mkdirSync(join(directory, 'other'));
		const failure = evidenceDirectoryFailure(join(root, '..', 'other'), root);

		expect(failure).toBe(FAILURE);
		recordExampleCases(
			meta(
				'rejects-a-sibling-directory-outside-the-run-root',
				'rejects-a-sibling-directory-outside-the-run-root.json'
			),
			[
				{
					name: 'sibling of the run root returns the ancestry failure',
					input: { directory: 'run/../other', root: 'run' },
					output: { failure }
				}
			]
		);
	});
});
