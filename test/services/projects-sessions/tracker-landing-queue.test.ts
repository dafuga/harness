import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { expect, test, vi, onTestFinished } from 'vitest';
import { TrackerPersistenceService } from '../../../src/services/projects-sessions/TrackerPersistenceService';
import {
	trackerLandingAuthority,
	type LandingRequest
} from '../../../src/services/projects-sessions/tracker-hub-sync/trackerLandingQueue';
import {
	reconcileLanding,
	trackerLandPull
} from '../../../src/commands/projects-sessions/tracker-command/trackerLandPull';

const base = '1'.repeat(40),
	head = '2'.repeat(40),
	squash = '3'.repeat(40);
const repo = 'fixture/project',
	id = 'fixture123',
	pr = 123;
const signal = new AbortController().signal;

function queueFixture() {
	const db = new DatabaseSync(':memory:');
	onTestFinished(() => db.close());
	const store = new TrackerPersistenceService(db, 'hub');
	store.appendLocal({ itemId: id, fields: { title: 'First fixture PR', status: 'open' } });
	let now = 1000;
	return {
		port: trackerLandingAuthority(store, () => now),
		advance: () => {
			now += 130000;
		}
	};
}
function gitFixture() {
	const original = { repo, branch: 'feature', sha: head };
	const open = {
		headRefName: 'feature',
		headRefOid: head,
		baseRefName: 'main' as const,
		state: 'OPEN' as 'OPEN' | 'MERGED' | 'CLOSED',
		isCrossRepository: false as const,
		isDraft: false,
		closingIssuesReferences: [],
		mergeCommit: null as null | { oid: string }
	};
	let merged = false;
	return {
		checkout: vi.fn(async () => original),
		base: vi.fn(async () => base),
		rebase: vi.fn(async () => head),
		publish: vi.fn(async () => {}),
		check: vi.fn(async () => {}),
		pull: vi.fn(async () =>
			merged ? { ...open, state: 'MERGED' as const, mergeCommit: { oid: squash } } : open
		),
		merge: vi.fn(async () => {
			merged = true;
			return '';
		}),
		verifyMerged: vi.fn(async () => {})
	};
}
test('the first ticket owns the repo across hosts and an uncertain merge never times out', () => {
	const { port, advance } = queueFixture();
	const a = { id, pr, repo, ticket: randomUUID() },
		b = { ...a, pr: 44, ticket: randomUUID() };
	expect(port({ ...a, action: 'wait' }, 'first').allowed).toBe(true);
	expect(port({ ...b, action: 'wait' }, 'second').allowed).toBe(false);
	expect(port({ ...a, action: 'authorize', base, head }, 'first').allowed).toBe(true);
	advance();
	expect(port({ ...b, action: 'wait' }, 'second').reason).toContain(id);
	expect(port({ ...a, action: 'release' }, 'second').allowed).toBe(false);
	expect(port({ ...a, action: 'inspect' }, 'first').pinned).toMatchObject({ base, head });
	expect(port({ ...a, action: 'release' }, 'first').allowed).toBe(true);
	expect(port({ ...b, action: 'wait' }, 'second').allowed).toBe(true);
});
test.each([2, 3])(
	'main moving at read %i refuses the merge and frees the slot',
	async (changedAt) => {
		const { port } = queueFixture();
		const git = gitFixture();
		let reads = 0;
		git.base.mockImplementation(async () => (++reads >= changedAt ? squash : base));
		await expect(
			trackerLandPull({ id, pr }, async (req) => port(req, 'first'), git, signal)
		).rejects.toThrow(/main moved/);
		expect(git.check).toHaveBeenCalledWith(id, head, base);
		expect(git.merge).not.toHaveBeenCalled();
		expect(port({ id, pr, repo, ticket: randomUUID(), action: 'wait' }, 'second').allowed).toBe(
			true
		);
	}
);
test('merge pins the checked head and reconciliation checks its squash parent and tree', async () => {
	const { port } = queueFixture();
	const git = gitFixture(),
		queue = async (req: LandingRequest) => port(req, 'first');
	git.verifyMerged.mockRejectedValueOnce(new Error('readback unavailable'));
	await expect(trackerLandPull({ id, pr }, queue, git, signal)).rejects.toThrow(
		'readback unavailable'
	);
	expect(git.merge).toHaveBeenCalledWith(repo, pr, head);
	expect(port({ id, pr, repo, ticket: randomUUID(), action: 'wait' }, 'second').allowed).toBe(
		false
	);
	expect(await reconcileLanding({ id, pr }, queue, git)).toContain('released');
	expect(git.verifyMerged).toHaveBeenCalledWith(squash, base, head);
});
