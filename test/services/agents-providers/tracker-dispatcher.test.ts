import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { TrackerDispatcherService } from '../../../src/services/agents-providers/TrackerDispatcherService';
import {
	dispatcherFixture,
	primary,
	sampleId,
	sampleToken,
	secondary
} from '../../support/trackerDispatcherFixture';

test('manual requests normalize aliases, keep the token on replay and reject changed options', async () => {
	const { item, service } = dispatcherFixture();
	const intent = { token: sampleToken, target: secondary, source: 'manual', sensitive: false };
	expect(
		await service.request(sampleId, {
			source: 'manual',
			token: sampleToken,
			options: { computer: ' MB2 ', model: 'sol:xhigh' }
		})
	).toEqual({ status: 'requested', intent });
	expect(item()).toMatchObject({ computer: secondary, model: 'sol:xhigh', launch: intent });
	expect(
		await service.request(sampleId, {
			source: 'manual',
			token: 'replayed-token',
			options: { computer: secondary }
		})
	).toEqual({ status: 'existing', intent });
	for (const options of [{ computer: 'mac' }, { model: 'sol:high' }, { sensitive: true }]) {
		expect(
			await service.request(sampleId, { source: 'manual', token: 'new-token', options })
		).toMatchObject({
			status: 'conflict'
		});
	}
	expect(await service.claim(sampleId, sampleToken)).toEqual({
		status: 'held',
		reason: 'launch is assigned to a different computer'
	});
});

test('explicit intent validates custom names and preserves the offline fallback on auto placement', async () => {
	const { service } = dispatcherFixture({
		item: { repo: '/home/box/workspace/fixture' },
		policy: {
			chooseHost: () => ({ node: null, why: 'no eligible runner' }),
			resolveHost: (node) => (node === 'office' ? primary : null)
		}
	});
	expect(
		await service.request(sampleId, {
			source: 'manual',
			token: sampleToken,
			options: { computer: 'unknown' }
		})
	).toMatchObject({ status: 'held', reason: expect.stringContaining('known tracker node') });
	expect(await service.request(sampleId, { source: 'manual', token: sampleToken })).toMatchObject({
		status: 'requested',
		intent: { target: 'grok-box' }
	});
	const custom = dispatcherFixture({
		policy: { resolveHost: (node) => (node === 'office' ? primary : null) }
	});
	expect(
		await custom.service.request(sampleId, {
			source: 'manual',
			token: sampleToken,
			options: { computer: 'office' }
		})
	).toMatchObject({ status: 'requested', intent: { target: primary } });
});

test('concurrent claimants commit one reservation; a peer claim still fences a stale replica', async () => {
	const { store, policy, service, runs, writeRun, changeItem, advance } = dispatcherFixture();
	await service.request(sampleId, { source: 'manual', token: sampleToken });
	const another = new TrackerDispatcherService(store, policy);
	const results = await Promise.all([
		service.claim(sampleId, sampleToken),
		another.claim(sampleId, sampleToken)
	]);
	expect(results.map(({ status }) => status).sort()).toEqual(['held', 'start']);
	expect(runs()).toHaveLength(1);
	const peer = dispatcherFixture();
	peer.changeItem({ launch: { target: primary, source: 'manual', token: sampleToken } });
	peer.writeRun({ ...runs()[0], node: secondary });
	peer.advance(481 * 60_000);
	expect(await peer.service.claim(sampleId, sampleToken)).toEqual({
		status: 'held',
		reason: 'launch token was already claimed'
	});
	writeRun({ ...runs()[0], state: 'finished', outcome: 'done' });
	changeItem({ launch: null });
	advance(60_000);
	expect(await service.request(sampleId, { source: 'manual', token: sampleToken })).toMatchObject({
		status: 'conflict'
	});
});
