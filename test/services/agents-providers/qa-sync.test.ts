import { describe, expect, test } from 'vitest';
import { mark, parent, reply, service, ts, world } from './qa-sync/qaSyncFixture';

describe('QaSyncService approvals', () => {
	test("adds the tester's label to an existing check mark and keeps other labels", async () => {
		const w = world();
		w.parents = [parent(5, { reactions: mark('UJESS', 'USTRANGER') })];
		const report = await service(w).sync();
		expect(w.labels.get(5)).toEqual(['bug', 'approved by Jessel']);
		expect(report).toMatchObject({ threads: 1, errors: [] });
		expect(w.notes).toEqual([]);
	});

	test('leaves a removed label off until the check mark is added again', async () => {
		const w = world();
		w.parents = [parent(5, { reactions: mark('UANDY') })];
		await service(w).sync();
		w.labels.set(5, ['bug']);
		await service(w).sync();
		expect(w.labels.get(5)).toEqual(['bug']);
		w.parents = [parent(5)];
		await service(w).sync();
		w.parents = [parent(5, { reactions: mark('UANDY') })];
		await service(w).sync();
		expect(w.labels.get(5)).toEqual(['bug', 'approved by Andriy']);
	});

	test('ignores other reactions, other authors and parents without an issue heading', async () => {
		const w = world();
		w.parents = [
			parent(5, { reactions: [{ name: 'x', count: 1, users: ['UJESS'] }] }),
			parent(5, { ts: ts(-400), user: 'UANYONE', botId: undefined, reactions: mark('UJESS') }),
			parent(5, { ts: ts(-300), text: '*Review runbook · Planner*', reactions: mark('UANDY') })
		];
		const report = await service(w).sync();
		expect(report.threads).toBe(1);
		expect(w.labels.get(5)).toEqual(['bug']);
	});
});

describe('QaSyncService safety', () => {
	test('skips a heading that disagrees with its issue link, and non-issues', async () => {
		const w = world();
		const wrong = parent(5).text.replace('/issues/5', '/issues/6');
		w.parents = [
			parent(5, { text: wrong, reactions: mark('UJESS') }),
			parent(7, { ts: ts(-400), reactions: mark('UJESS') })
		];
		const report = await service(w).sync();
		expect(report.actions).toEqual([]);
		expect(report.warnings).toEqual([
			expect.stringContaining('heading #5 links issue(s) 6'),
			expect.stringContaining('#7 is not an issue')
		]);
	});

	test('a dry run reports the work and writes nothing', async () => {
		const w = world();
		w.parents = [parent(5, { reactions: mark('UJESS') })];
		reply(w, 10, 'step 2 fails');
		w.clock += 60;
		const report = await service(w).sync({ dryRun: true, backfillComments: true });
		expect(report.actions.map((action) => action.kind)).toEqual(['label', 'note']);
		expect([w.labels.get(5), w.notes, w.state]).toEqual([['bug'], [], undefined]);
	});
});

describe('QaSyncService replies', () => {
	test('treats replies before the first run as old, then notes each new one once', async () => {
		const w = world();
		reply(w, -100, 'old feedback');
		await service(w).sync();
		expect(w.notes).toEqual([]);
		reply(w, 10, 'Step 3 shows a blank dialog');
		w.replies.push({ ts: ts(11), text: 'automated checklist', user: 'UBOT', botId: 'BBOT' });
		await service(w).sync();
		await service(w).sync();
		expect(w.notes).toHaveLength(1);
		expect(w.notes[0].id).toBe('inbox1');
		expect(w.notes[0].text).toContain('acme/app#5');
		expect(w.notes[0].text).toContain('Jessel: "Step 3 shows a blank dialog"');
		expect(w.notes[0].text).not.toContain('old feedback');
		expect(w.notes[0].text).toContain(`?thread_ts=${ts(-500)}&cid=C1`);
	});
});

describe('QaSyncService routing and retries', () => {
	test('routes to the one open item naming the issue, redacting secrets', async () => {
		const w = world();
		await service(w).sync();
		w.items = [
			{ id: 'owner1', title: 'Fix logo upload (#5)' },
			{ id: 'other1', title: 'Fix #55' },
			{ id: 'batch1', title: 'Record videos for #5 #6 #7' }
		];
		reply(w, 10, `my token: ${'xox' + 'b-1234567890-abcdefgh'}`, 'UDEV');
		await service(w).sync();
		expect(w.notes[0].id).toBe('owner1');
		expect(w.notes[0].text).toContain('Slack UDEV: "my [redacted]');
		expect(w.notes[0].text).not.toContain('abcdefgh');
		w.items = [{ id: 'batch1', title: 'Record videos for #5 #6 #7' }];
		await service(w).sync();
		reply(w, 20, 'still broken');
		await service(w).sync();
		expect(w.notes[1]).toMatchObject({ id: 'inbox1' });
		expect(w.notes[1].text).toContain('Related items: batch1.');
	});

	test('adds the retest label only for allowed requesters', async () => {
		const w = world();
		await service(w).sync();
		reply(w, 10, 'Ready for retest', 'UDEV');
		await service(w).sync();
		expect(w.labels.get(5)).toEqual(['bug']);
		reply(w, 20, 'Fix is deployed, please retest on prod.', 'UBOSS');
		await service(w).sync();
		expect(w.labels.get(5)).toEqual(['bug', 'needs testing on production']);
	});

	test('keeps the cursor when the tracker fails, so the comment is retried', async () => {
		const w = world();
		await service(w).sync();
		reply(w, 10, 'broken on save');
		w.failNotes = true;
		const failed = await service(w).sync();
		expect(failed.errors).toEqual(['#5 replies: tracker down']);
		w.failNotes = false;
		await service(w).sync();
		expect(w.notes).toHaveLength(1);
	});
});
