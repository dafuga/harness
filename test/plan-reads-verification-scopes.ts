/** Planning operation reads: the real-fixture operations and the Git that planReads returns. */
export const planReadsVerificationTests: Record<string, Record<string, string>> = {
	'test/utils/plan-reads.test.ts': {
		'one operation runs each pinned read once and answers as reads made one by one':
			'operation-read-isolation',
		'each operation reads again: it sees an approval, a new commit and a branch that moved':
			'operation-read-isolation'
	},
	'test/plan-reads-port.test.ts': {
		'concurrent pinned reads of one object share one Git call': 'operation-read-isolation',
		'each answer is its own copy of the bytes': 'operation-read-isolation',
		'HEAD, branches, short ids and a new operation read again': 'operation-read-isolation',
		'a read that failed runs again': 'operation-read-isolation',
		'input, environment and writes always reach Git': 'operation-read-isolation'
	}
};
