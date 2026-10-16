import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { WireEvent } from '../../remote/src/index';
import type { RunEvent } from '../src/models/DesktopBridge.types';
import { connect, deferred, remoteFixture } from './remote-fixture';
import { git } from './run-fixture';

const settle = { timeout: 15000 };
const sequences = (frames: string[]) =>
	frames
		.map((frame) => JSON.parse(frame) as WireEvent)
		.filter((message) => message.type === 'event')
		.map((event) => event.sequence);

test('a start request re-sent after a reconnect does not start a second run', async () => {
	const gate = deferred(),
		f = await remoteFixture(() => gate.promise),
		phone = f.device(),
		first = await phone.connect(),
		events: RunEvent[] = [];
	first.client.on('run', (event) => events.push(event as RunEvent));
	let runId = '';
	try {
		first.state.lossy = true;
		const pending = first.client.request<{ runId: string }>('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		first.client.unbind();
		first.link.close();
		const frames: string[] = [];
		const link = phone.session.wire.connect((text) => {
			frames.push(text);
			first.client.receive(text);
		});
		const attachment = await first.client.bind((text) => void link.receive(text));
		expect(attachment.replay).toBe('resumed');
		({ runId } = await pending);
		expect(f.run).toHaveBeenCalledOnce();
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((event) => event.runId === runId)).toBe(true);
		expect(sequences(frames)).toEqual([...sequences(frames)].sort((a, b) => a - b));
		expect(new Set(sequences(frames)).size).toBe(sequences(frames).length);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	expect(f.run).toHaveBeenCalledOnce();
	expect(events.at(-1)).toMatchObject({ kind: 'finished', runId });
	const asked = await f.planning.messages(
		f.request.entityId,
		f.request.threadId,
		git(f.root, 'rev-parse', 'HEAD')
	);
	expect(asked.filter((m) => m.author === 'user' && m.text === f.request.text)).toHaveLength(1);
}, 40000);

test('a second connection of a device takes over events without repeating them', async () => {
	const gate = deferred(),
		f = await remoteFixture(() => gate.promise),
		phone = f.device(),
		first = await phone.connect(),
		second = await connect(phone.session),
		seen: RunEvent[] = [];
	second.client.on('run', (event) => seen.push(event as RunEvent));
	const before = first.frames.length;
	try {
		await second.client.request('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
	} finally {
		gate.resolve();
	}
	await expect.poll(() => seen.at(-1)?.kind, settle).toBe('finished');
	expect(first.frames).toHaveLength(before);
	expect(sequences(second.frames)).toEqual(seen.map((_, index) => index + 1));
}, 40000);

test('ending a device session cancels its run and delivers nothing more', async () => {
	const gate = deferred(),
		f = await remoteFixture(() => gate.promise),
		phone = f.device(),
		{ client, frames, link } = await phone.connect();
	try {
		await client.request('startRun', f.start());
		await expect.poll(() => f.run.mock.calls.length, settle).toBe(1);
		phone.session.end();
		expect(f.run.mock.calls[0][0].signal.aborted).toBe(true);
	} finally {
		gate.resolve();
	}
	const delivered = frames.length;
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	const late = { type: 'request', id: crypto.randomUUID(), method: 'listProjects', input: {} };
	await link.receive(JSON.stringify(late));
	expect(frames).toHaveLength(delivered);
	expect(phone.session.wire.ended).toBe(true);
	const again = await f.device().connect();
	expect(await again.client.request('listProjects')).toHaveLength(1);
}, 40000);
