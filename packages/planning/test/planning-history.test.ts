import { expect, test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { author, contract, git, fixture } from './planFixture';
test('branch snapshots and ancestry history contain only the selected entity', async () => {
	const { root, api } = await fixture();
	const first = await api.createPlan({
		category: 'function',
		slug: 'first',
		title: 'First',
		goal: 'First',
		author,
		contract
	});
	git(root, 'checkout', '-b', 'alternate');
	const other = await api.createPlan({
		category: 'function',
		slug: 'other',
		title: 'Other',
		goal: 'Other',
		author,
		contract
	});
	expect((await api.listPlans({ revision: first.commit })).map((p) => p.unitId)).toEqual([
		'function.first'
	]);
	const history = await api.entityHistory({ unitId: 'function.first' });
	expect(history.entries.map((e) => e.commit)).toEqual([first.commit]);
	expect(history.entries.flatMap((e) => e.events)).toEqual([{ kind: 'plan-created' }]);
	expect(history.entries.map((e) => e.commit)).not.toContain(other.commit);
	const branches = await api.listBranches();
	expect(branches.find((b) => b.name === 'alternate')?.current).toBe(true);
	expect((await api.listCommits({ revision: 'main' }))[0].commit).toBe(first.commit);
	git(root, 'checkout', '--detach', first.commit);
	await expect(
		api.createPlan({
			category: 'function',
			slug: 'detached',
			title: 'D',
			goal: 'D',
			author,
			contract
		})
	).rejects.toThrow();
	expect(git(root, 'rev-parse', 'HEAD')).toBe(first.commit);
});
test('rejects changed historical message prefix even with a recomputed current hash chain', async () => {
	const { root, api } = await fixture();
	await api.createPlan({
		category: 'function',
		slug: 'first',
		title: 'First',
		goal: 'First',
		author,
		contract
	});
	const opened = await api.openThread({
		unitId: 'function.first',
		version: null,
		file: null,
		imageSha256: null,
		region: null,
		author,
		message: { author, mode: 'plan', body: 'Original' }
	});
	const message = { ...opened.value.messages[0], body: 'Rewritten' };
	await writeFile(
		join(root, `src/functions/first/threads/${opened.value.id}/messages.ndjson`),
		JSON.stringify(message) + '\n'
	);
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'rewrite');
	await expect(api.readPlan({ unitId: 'function.first' })).rejects.toThrow('rewritten');
	expect(
		(await api.readPlan({ unitId: 'function.first', revision: opened.commit })).threads[0]
			.messages[0].body
	).toBe('Original');
});
