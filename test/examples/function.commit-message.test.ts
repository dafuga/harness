import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { writtenMessage, commitMessage } from '../../src/services/git-source-history/commit-message-service/commitMessage';
import { commitPrefixes } from '../../src/utils/git-source-history/commitMessage';

test('Written messages follow Git cleanup modes', () => {
	const stripped = writtenMessage(
		'feat: add retries\n\nRetry transient errors.\n# Please enter the commit message\n'
	);
	const verbatim = writtenMessage('  fix: keep  spaces\n# comment  ', {
		cleanup: 'verbatim',
		comment: ';'
	});
	const scissors = writtenMessage(
		'fix: handle missing values\n# keep this line\n\nbody\n# ------------------------ >8 ------------------------\nignored',
		{ cleanup: 'scissors', comment: '#' }
	);
	expect([stripped, verbatim, scissors]).toEqual([
		'feat: add retries\n\nRetry transient errors.',
		'fix: keep  spaces\n# comment',
		'fix: handle missing values\n# keep this line\n\nbody'
	]);
	expect(commitPrefixes).toEqual(['feat:', 'fix:', 'chore:', 'cleanup:']);
	recordExampleCases(
		{
			unitId: 'function.commit-message',
			symbol: 'writtenMessage',
			state: 'written-messages-follow-git-cleanup-modes',
			evidence: 'examples-cases',
			file: 'written-messages-follow-git-cleanup-modes.json'
		},
		[
			{
				name: 'default stripping removes comment and trailing newline',
				input: 'feat: add retries\n\nRetry transient errors.\n# Please enter the commit message\n',
				output: stripped
			},
			{
				name: 'verbatim trims only the outer edges',
				input: { file: '  fix: keep  spaces\n# comment  ', options: { cleanup: 'verbatim', comment: ';' } },
				output: verbatim
			},
			{
				name: 'scissors mode retains comments above the cut',
				input: { file: 'fix: handle missing values\n# keep this line\n\nbody\n# ------------------------ >8 ------------------------\nignored', options: { cleanup: 'scissors', comment: '#' } },
				output: scissors
			}
		]
	);
});

test('Stored messages report prefix and line-ending problems', () => {
	const valid = commitMessage('fix: handle missing values\r\n\r\nReject empty input.\r');
	const missingPrefix = commitMessage('update the changelog');
	const emptySubject = commitMessage('\nbody');
	expect(valid).toEqual([]);
	expect(missingPrefix).toContain(
		'subject does not start with feat:, fix:, chore: or cleanup:.'
	);
	expect(emptySubject).not.toContain(
		'subject does not start with feat:, fix:, chore: or cleanup:.'
	);
	recordExampleCases(
		{
			unitId: 'function.commit-message',
			symbol: 'commitMessage',
			state: 'stored-messages-report-prefix-and-line-ending-problems',
			evidence: 'examples-cases',
			file: 'stored-messages-report-prefix-and-line-ending-problems.json'
		},
		[
			{
				name: 'CRLF message with allowed prefix has no violations',
				input: 'fix: handle missing values\r\n\r\nReject empty input.\r',
				output: valid
			},
			{
				name: 'nonempty subject without an allowed prefix is reported',
				input: 'update the changelog',
				output: missingPrefix
			},
			{
				name: 'empty subject uses length validation without prefix error',
				input: '\nbody',
				output: emptySubject
			}
		]
	);
});
