import { test } from 'vitest';
import { exactRef } from '../../src/utils/git-source-history/create-git-hub-source/exactRef';
import {
	base64,
	decode64,
	readRef,
	refPath
} from '../../src/utils/git-source-history/githubTransport';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import {
	evidence,
	clientWithResponses,
	response,
	commit,
	requestSummary,
	captureError
} from './collaboration.function.github-transport.cases';

test('Maps supported Git refs to API paths', () => {
	const cases = [
		{ ref: 'refs/heads/main', path: 'heads/main' },
		{ ref: 'refs/notes/releases', path: 'notes/releases' },
		{ ref: 'refs/tags/v2.4.0', path: 'tags/v2.4.0' },
		{ ref: 'refs/heads/feature/release#1', path: 'heads/feature/release%231' }
	];
	const results = cases.map(({ ref }) => refPath(ref));
	expect(results).toEqual(cases.map(({ path }) => path));
	recordExampleCases(
		evidence('refPath', 'maps-supported-git-refs-to-api-paths'),
		cases.map(({ ref, path }) => ({ name: `map ${ref}`, input: { ref }, output: { path } }))
	);
});

test('Reads exact branch and notes refs', async () => {
	const other = '1111111111111111111111111111111111111111';
	const notesSha = '2222222222222222222222222222222222222222';
	const reads = clientWithResponses('read', [
		response({ ref: 'refs/heads/main', object: { sha: commit } }),
		response([
			{ ref: 'refs/notes/releases/old', object: { sha: other } },
			{ ref: 'refs/notes/releases', object: { sha: notesSha } }
		]),
		response([])
	]);
	const branchSha = await readRef(reads.client, 'refs/heads/main');
	const notesResult = await readRef(reads.client, 'refs/notes/releases');
	const emptyNotes = await readRef(reads.client, 'refs/notes/missing');
	expect(branchSha).toBe(commit);
	expect(notesResult).toBe(notesSha);
	expect(emptyNotes).toBeNull();
	expect(requestSummary(reads.calls).map(({ path }) => path)).toEqual([
		'/repos/northstar-labs/project-data/git/ref/heads/main',
		'/repos/northstar-labs/project-data/git/matching-refs/notes/releases',
		'/repos/northstar-labs/project-data/git/matching-refs/notes/missing'
	]);
	recordExampleCases(evidence('readRef', 'reads-exact-branch-and-notes-refs'), [
		{
			name: 'read the exact main branch ref',
			input: { repository: 'northstar-labs/project-data', ref: 'refs/heads/main' },
			output: { sha: branchSha, requestPath: requestSummary(reads.calls)[0]?.path }
		},
		{
			name: 'match the exact notes ref among a prefix result',
			input: {
				ref: 'refs/notes/releases',
				matchingRefs: ['refs/notes/releases/old', 'refs/notes/releases']
			},
			output: { sha: notesResult, requestPath: requestSummary(reads.calls)[1]?.path }
		},
		{
			name: 'treat an empty notes match as absent',
			input: { ref: 'refs/notes/missing', matchingRefs: [] },
			output: { sha: emptyNotes }
		}
	]);
});

test('Resolves exact refs and rejects missing refs', async () => {
	const resolved = clientWithResponses('read', [
		response({ ref: 'refs/tags/v2.4.0', object: { sha: commit } }),
		new Response(null, { status: 404 })
	]);
	const ref = 'refs/tags/v2.4.0';
	const result = await exactRef(resolved.client, ref);
	const missingError = await captureError(() => exactRef(resolved.client, 'refs/heads/archive'));
	expect(result).toBe(commit);
	expect(missingError).toEqual({ message: 'Collaboration not-found', code: 'not-found' });
	recordExampleCases(evidence('exactRef', 'resolves-exact-refs-and-rejects-missing-refs'), [
		{
			name: 'resolve the exact release tag',
			input: { ref },
			output: { sha: result }
		},
		{
			name: 'reject a missing branch ref',
			input: { ref: 'refs/heads/archive', responseStatus: 404 },
			error: missingError
		}
	]);
});

test('Encodes byte arrays as standard base64', () => {
	const inputs = [
		[72, 101, 108, 108, 111],
		[0, 1, 2]
	];
	const results = inputs.map((bytes) => base64(Uint8Array.from(bytes)));
	expect(results).toEqual(['SGVsbG8=', 'AAEC']);
	recordExampleCases(evidence('base64', 'encodes-byte-arrays-as-standard-base64'), [
		{ name: 'encode Hello bytes', input: { bytes: inputs[0] }, output: { value: results[0] } },
		{
			name: 'encode leading zero bytes',
			input: { bytes: inputs[1] },
			output: { value: results[1] }
		}
	]);
});

test('Decodes whitespace and rejects invalid base64', async () => {
	const value = ' SGVs\nbG8= ';
	const bytes = decode64(value);
	const invalidError = await captureError(() => decode64('***'));
	expect([...bytes]).toEqual([72, 101, 108, 108, 111]);
	expect(invalidError).toEqual({
		message: 'Collaboration invalid-content',
		code: 'invalid-content'
	});
	recordExampleCases(evidence('decode64', 'decodes-whitespace-and-rejects-invalid-base64'), [
		{
			name: 'ignore whitespace around encoded text',
			input: { value },
			output: { bytes: [...bytes] }
		},
		{ name: 'reject invalid encoded content', input: { value: '***' }, error: invalidError }
	]);
});
