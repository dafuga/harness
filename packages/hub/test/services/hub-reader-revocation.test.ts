import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import {
	asked,
	bound,
	bytesOf,
	colleague,
	evidenceFixture,
	read
} from '../support/evidenceFixture';

for (const kind of ['metadata', 'artifact'] as const) {
	test(`membership revoked while ${kind} is being read denies the final answer`, async () => {
		const f = evidenceFixture();
		const query = asked(f.commits.changed, 'verified', 'current');
		const capture = kind === 'artifact' ? bound(await read(f, query, colleague), query) : undefined;
		const branches = f.source.branches;
		f.source.branches = async (repository) => {
			const result = await branches(repository);
			f.shared.members = f.shared.members.filter((member) => member.actorId !== colleague.id);
			return result;
		};
		const pending = capture ? bytesOf(f, capture, colleague) : read(f, query, colleague);
		await expect(pending).rejects.toMatchObject({ code: 'forbidden' });
	});
}

test('a revoked principal cannot use a previously kept metadata answer', async () => {
	const f = evidenceFixture();
	const query = asked(f.commits.changed, 'verified', 'current');
	await read(f, query, colleague);
	f.shared.members = f.shared.members.filter((member) => member.actorId !== colleague.id);
	const before = { reads: f.reads.length, calls: f.calls.length };
	await expect(read(f, query, colleague)).rejects.toMatchObject({ code: 'forbidden' });
	expect({ reads: f.reads.length, calls: f.calls.length }).toEqual(before);
});

test('a merge commit compares only its exact first parent', async () => {
	const f = evidenceFixture();
	f.git.commits.get(f.commits.changed)!.parents = [f.commits.root, f.commits.side];
	const result = await read(f, asked(f.commits.changed, 'main', 'commit'));
	expect(result.scope.summary.parents).toEqual([f.commits.root, f.commits.side]);
	expect(result.evidence.before?.commit).toBe(f.commits.root);
});
