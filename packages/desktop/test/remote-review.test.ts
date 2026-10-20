import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RemoteAttachment, WireResponse } from '../../remote/src/index';
import type { EntityDetail, ThreadInfo } from '../src/models/Desktop.types';
import { RemoteHostService } from '../src/services/remote-host-service/RemoteHostService';
import { RemoteLifecycleService } from '../src/services/RemoteLifecycleService';
import type { PowerEvent } from '../src/services/RemoteLifecycleService';
import { remoteFixture } from './remote-fixture';
import { hostFixture } from './remote-host-fixture';

const settle = { timeout: 15000 };
const refusal = (work: Promise<unknown>) =>
	work.then(
		() => 'accepted',
		(error: { code?: string }) => error.code ?? 'threw'
	);

test('a view pinned to a commit is read-only even at the tip: a change needs a branch view', async () => {
	const f = await remoteFixture(),
		{ client } = await f.device().connect(),
		projectId = f.project.id,
		plan = { projectId, category: 'pages', title: 'Pinned', goal: 'Review rule' },
		{ commit } = f.revision();
	await client.request('snapshot', { projectId, branch: 'main', commit });
	expect(await refusal(client.request('createPlan', { ...plan, revision: f.revision() }))).toBe(
		'read-only'
	);
	await client.request('snapshot', { projectId, branch: 'main', commit: null });
	const created = await client.request<EntityDetail>('createPlan', {
		...plan,
		revision: f.revision()
	});
	expect(created.title).toBe('Pinned');
}, 40000);

test('a comment-only phone can open the thread a comment needs, and nothing more', async () => {
	const f = await remoteFixture(),
		grant = { projects: [{ id: f.project.id, name: f.project.name }], agents: false },
		{ client, attachment } = await f.device(grant).connect(),
		projectId = f.project.id,
		thread = {
			projectId,
			entityId: f.request.entityId,
			version: null,
			imageSha256: null,
			state: null,
			viewport: null,
			region: null
		};
	expect(attachment.methods).toContain('openThread');
	expect(attachment.methods).toContain('addComment');
	for (const method of ['createPlan', 'approve', 'startRun', 'cancelRun'])
		expect(attachment.methods).not.toContain(method);
	expect(await refusal(client.request('openThread', thread))).toBe('revision-required');
	const opened = await client.request<ThreadInfo>('openThread', {
		...thread,
		revision: f.revision()
	});
	expect(opened.id.length).toBeGreaterThan(0);
	const plan = { projectId, category: 'pages', title: 'No', goal: 'No', revision: f.revision() };
	expect(await refusal(client.request('createPlan', plan))).toBe('method-denied');
	expect(await client.request('capabilities', { projectId })).toMatchObject({
		comments: true,
		agents: false,
		planning: false,
		approval: false
	});
	expect(f.run).not.toHaveBeenCalled();
}, 40000);

test('a change that does not name the session epoch is refused before anything runs', async () => {
	const f = await remoteFixture(),
		phone = f.device(),
		sent: WireResponse[] = [],
		link = phone.session.wire.connect((text) => sent.push(JSON.parse(text) as WireResponse)),
		call = async (method: string, input: Record<string, unknown>) => {
			const id = crypto.randomUUID();
			await link.receive(JSON.stringify({ type: 'request', id, method, input }));
			return sent.find((message) => message.type === 'response' && message.id === id);
		};
	const attach = { protocol: 1, client: { kind: 'test', name: 'fixture' }, resume: null },
		attached = await call('session.attach', attach),
		{ epoch } = (attached as { value: RemoteAttachment }).value;
	for (const stale of [{}, { epoch: 'f'.repeat(32) }])
		expect(await call('startRun', { ...f.start(), ...stale })).toMatchObject({
			ok: false,
			error: { code: 'request-expired' }
		});
	expect(f.run).not.toHaveBeenCalled();
	expect(await call('startRun', { ...f.start(), epoch })).toMatchObject({ ok: true });
	await expect.poll(() => f.arbiter.held(f.root), settle).toBe(false);
	expect(f.run).toHaveBeenCalledOnce();
}, 40000);

test('a phone is told the lock state once the computer knows it, and never a guess', async () => {
	const f = await hostFixture(),
		screen: { locked?: boolean } = {},
		host = new RemoteHostService(f.options({ locked: () => screen.locked })),
		listeners = new Map<string, () => void>(),
		seen: unknown[] = [];
	new RemoteLifecycleService({
		power: { on: (event, listener) => listeners.set(event, listener) },
		host,
		cancelLocal: () => undefined,
		screen: (locked) => {
			screen.locked = locked;
			host.screen(locked);
		}
	}).start();
	const fire = (event: PowerEvent) => listeners.get(event)?.();
	await host.enable();
	await f.online(host);
	const { credentials } = await f.pair(undefined, host),
		first = f.phone(credentials),
		unknown = await first.connection.connect();
	expect('locked' in unknown.host).toBe(false);
	first.client.on('connection', (event) => seen.push(event));
	fire('lock-screen');
	await expect.poll(() => seen, settle).toEqual([{ kind: 'host', state: 'locked' }]);
	first.connection.close();
	const second = f.phone(credentials);
	expect((await second.connection.connect()).host.locked).toBe(true);
	second.client.on('connection', (event) => seen.push(event));
	fire('unlock-screen');
	await expect.poll(() => seen.at(-1), settle).toEqual({ kind: 'host', state: 'unlocked' });
	expect(await second.client.request('listProjects')).toHaveLength(1);
	await host.stop();
}, 40000);
