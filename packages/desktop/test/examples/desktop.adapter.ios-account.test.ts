import { rmSync } from 'node:fs';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { temporaryDirectories, nativeAccountResult } from './desktop.adapter.ios-account.cases';

const projectPath = '/api/projects/11111111-1111-4111-8111-111111111111/snapshot';
const requestStateId = 'request-returns-project-answers-and-clears-a-401-session';

afterEach(() => {
	for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
	temporaryDirectories.clear();
});

test('request returns project answers and clears a 401 session', () => {
	const result = nativeAccountResult('request') as {
		success: { status: number; contentType: string; data: string };
		unauthorized: { status: number; contentType: string; data: string };
		afterUnauthorized: unknown;
	};
	expect(result.success).toEqual({
		status: 200,
		contentType: 'application/json',
		data: Buffer.from('{"ok":true}').toString('base64')
	});
	expect(result.unauthorized).toEqual({
		status: 401,
		contentType: 'application/json',
		data: Buffer.from('{"error":"session-required"}').toString('base64')
	});
	expect(result.afterUnauthorized).toEqual({ configured: true, state: 'signed-out' });
	recordExampleCases(
		{
			unitId: 'desktop.adapter.ios-account',
			symbol: 'request',
			state: requestStateId,
			evidence: 'examples-cases',
			file: `${requestStateId}.json`
		},
		[
			{
				name: 'read a project snapshot and handle the expired session',
				input: { method: 'GET', path: projectPath },
				output: result
			}
		]
	);
}, 20_000);
