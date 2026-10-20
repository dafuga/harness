import { expect, test } from 'vitest';
import { pushedRefs } from '../../src/services/hook-run-service/pushedRefs';

const sha = (letter: string) => letter.repeat(40);
const line = (local: string, remote: string, localSha = sha('a')) =>
	`${local} ${localSha} ${remote} ${sha('0')}`;

test('pushedRefs returns the new tips of source branches, once each', () => {
	const input = [
		line('refs/heads/main', 'refs/heads/main'),
		line('HEAD', 'refs/heads/feature', sha('b')),
		line('refs/heads/copy', 'refs/heads/copy')
	].join('\n');
	expect(pushedRefs(`${input}\n`)).toEqual([sha('a'), sha('b')]);
});

test('pushedRefs ignores evidence, notes, archived source, tags, deletions and noise', () => {
	const input = [
		line('refs/heads/harness-evidence', 'refs/heads/harness-evidence'),
		line('refs/notes/harness', 'refs/notes/harness'),
		line(`refs/harness/source/${sha('c')}`, `refs/harness/source/${sha('c')}`),
		line('refs/tags/v1', 'refs/tags/v1'),
		line('(delete)', 'refs/heads/gone', sha('0')),
		'',
		'not a ref line'
	].join('\n');
	expect(pushedRefs(input)).toEqual([]);
});
