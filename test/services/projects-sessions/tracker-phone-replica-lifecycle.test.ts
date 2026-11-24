import { test } from 'vitest';
import { expect } from '../../verificationExpect';

import { hub } from './trackerPhoneFixture';
import type { LifecycleFixture, LifecycleRow } from './tracker-phone-replica-lifecycle.types';

let counter = 0;
function intentId(): string {
	counter += 1;
	return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

async function current(fixture: LifecycleFixture): Promise<LifecycleRow> {
	const body = await (await fixture.pull()).json();
	return body.rows[0] as LifecycleRow;
}

/** A phone write that names the revision and status it was showing. */
async function act(fixture: LifecycleFixture, action: string, text: string, seen?: LifecycleRow) {
	const view = seen ?? (await current(fixture));
	const expectedStatus = ['note', 'flag', 'answer'].includes(action) ? null : view.status;
	const revision = action === 'note' ? null : view.attentionRevision;
	return fixture.write({ intentId: intentId(), action, text, revision, expectedStatus });
}

test('applies phone lifecycle actions through the shared item planner', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { title: 'Lifecycle task', status: 'open' });
		expect(await (await act(fixture, 'start', '')).json()).toMatchObject({ status: 'accepted' });
		expect((await current(fixture)).status).toBe('in_progress');

		expect(await (await act(fixture, 'block', 'Waiting on a key')).json()).toMatchObject({
			status: 'accepted'
		});
		expect((await current(fixture)).status).toBe('blocked');

		expect(await (await act(fixture, 'unblock', 'Key arrived')).json()).toMatchObject({
			status: 'accepted'
		});
		expect((await current(fixture)).status).toBe('in_progress');
	} finally {
		fixture.db.close();
	}
});

test('refuses a lifecycle write whose expected status or revision is stale', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { title: 'Stale task', status: 'open' });
		const seen = await current(fixture);
		expect(await (await act(fixture, 'start', '', seen)).json()).toMatchObject({
			status: 'accepted'
		});
		const stale = await act(fixture, 'done', 'Shipped', seen);
		expect(await stale.json()).toMatchObject({ status: 'conflict', reason: 'attention' });
		expect((await current(fixture)).status).toBe('in_progress');

		fixture.item('fixture001', { needs_daniel: 1, resolved: 0, question: 'Changed question' });
		const moved = await fixture.write({
			intentId: intentId(),
			action: 'ignore',
			text: 'Not needed',
			revision: seen.attentionRevision,
			expectedStatus: 'in_progress'
		});
		expect(await moved.json()).toMatchObject({ status: 'conflict', reason: 'attention' });
	} finally {
		fixture.db.close();
	}
});

test('rejects phone write actions outside the lifecycle allowlist', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { title: 'Guarded task', status: 'open' });
		for (const action of ['remove', 'add', 'update', 'create', 'unflag']) {
			const reply = await act(fixture, action, 'x');
			expect(reply.status).toBe(400);
		}
		expect((await current(fixture)).status).toBe('open');
	} finally {
		fixture.db.close();
	}
});

test('requires a reason for block and ignore, and keeps ignore reversible', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { title: 'Reason task', status: 'open' });
		expect((await act(fixture, 'ignore', ' ')).status).toBe(400);
		expect(await (await act(fixture, 'ignore', 'Not needed this week')).json()).toMatchObject({
			status: 'accepted'
		});
		expect((await current(fixture)).status).toBe('ignored');
		expect(await (await act(fixture, 'unignore', '')).json()).toMatchObject({
			status: 'accepted'
		});
		expect((await current(fixture)).status).toBe('open');
	} finally {
		fixture.db.close();
	}
});

test('a repeated lifecycle intent replays its receipt without applying twice', async () => {
	const fixture = hub();
	try {
		fixture.item('fixture001', { title: 'Replay task', status: 'open' });
		const seen = await current(fixture);
		const done = {
			intentId: intentId(),
			action: 'done',
			text: 'Shipped',
			revision: seen.attentionRevision,
			expectedStatus: 'open'
		};
		const accepted = { intentId: done.intentId, status: 'accepted' };
		expect(await (await fixture.write(done)).json()).toEqual(accepted);
		fixture.restart();
		expect(await (await fixture.write(done)).json()).toEqual(accepted);
		expect((await current(fixture)).status).toBe('done');
	} finally {
		fixture.db.close();
	}
});
