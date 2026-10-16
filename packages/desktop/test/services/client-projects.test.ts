import { afterEach, expect, test, vi } from 'vitest';
import { ClientProjectsService } from '../../src/services/ClientProjectsService';
import { CommentOutboxService } from '../../src/services/CommentOutboxService';
import { ProjectSessionService } from '../../src/services/ProjectSessionService';
import { deferred, remoteFixture } from '../remote-fixture';

afterEach(() => vi.restoreAllMocks());
async function setup() {
	const f = await remoteFixture(),
		{ registry, arbiter, providers, generator } = f,
		shared = { registry, arbiter, providers, generator, outbox: new CommentOutboxService() };
	return { f, projects: new ClientProjectsService({ ...shared, emit: () => undefined }) };
}
/** Opening reads Git and cannot be aborted: this holds it open until the test lets go. */
function slowOpening() {
	const entered = deferred(),
		release = deferred(),
		original = ProjectSessionService.prototype.open,
		spy = vi.spyOn(ProjectSessionService.prototype, 'open');
	spy.mockImplementation(async function (this: ProjectSessionService, root: string) {
		entered.resolve();
		await release.promise;
		return original.call(this, root);
	});
	return { entered, release, spy };
}

test('a client opens a project once, whoever asks first', async () => {
	const { f, projects } = await setup(),
		spy = vi.spyOn(ProjectSessionService.prototype, 'open');
	const [one, two] = await Promise.all([projects.use(f.project.id), projects.use(f.project.id)]);
	expect(one).toBe(two);
	expect(spy).toHaveBeenCalledOnce();
	expect(projects.roots).toEqual([f.root]);
	await expect(projects.use('local-' + 'e'.repeat(64))).rejects.toThrow();
}, 30000);

test('a project that finishes opening after the client ended is dropped, not kept', async () => {
	const { f, projects } = await setup(),
		{ entered, release } = slowOpening(),
		pending = projects.use(f.project.id);
	await entered.promise;
	projects.end();
	release.resolve();
	await expect(pending).rejects.toThrow('ended');
	expect(projects.roots).toEqual([]);
	expect(projects.ended).toBe(true);
}, 30000);

test('an ended client opens nothing more', async () => {
	const { f, projects } = await setup(),
		spy = vi.spyOn(ProjectSessionService.prototype, 'open');
	projects.end();
	await expect(projects.use(f.project.id)).rejects.toThrow('ended');
	expect(spy).not.toHaveBeenCalled();
	expect(projects.roots).toEqual([]);
}, 30000);
