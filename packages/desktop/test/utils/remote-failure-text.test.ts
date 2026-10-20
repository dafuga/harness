import { expect, test } from 'vitest';
import { homedir } from 'node:os';
import { RemoteFailure, remoteErrorMessages } from '../../../remote/src/index';
import { remoteFailureText } from '../../src/services/device-session-service/remoteFailureText';

const root = '/private/tmp/fixture-repository';
test('declared failures keep their code and words', () => {
	expect(remoteFailureText(new RemoteFailure('busy'))).toEqual({
		code: 'busy',
		message: remoteErrorMessages.busy
	});
});
test('plain words of the desktop are passed on', () => {
	expect(remoteFailureText(new Error('Thread does not belong to this entity.'), [root])).toEqual({
		code: 'failed',
		message: 'Thread does not belong to this entity.'
	});
});
test('anything that still names a path, or is not an error, becomes the generic words', () => {
	const generic = { code: 'failed', message: remoteErrorMessages.failed };
	const hidden = [
		new Error(`ENOENT: no such file, open '${root}/private.txt'`),
		new Error(`fatal: not a git repository: ${homedir()}/somewhere/.git`),
		new Error('Command failed: git -C /Users/someone/repo show'),
		new Error('C:\\Users\\someone\\repo is locked'),
		new Error('x'.repeat(301)),
		new Error(''),
		'text',
		null
	];
	for (const error of hidden) expect(remoteFailureText(error, [root])).toEqual(generic);
});
