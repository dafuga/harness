import { afterEach, test, vi } from 'vitest';
// prettier-ignore
import { createProject, removeMember } from '../../src/utils/projects-sessions/create-collaboration/createProject';
// prettier-ignore
import type { Actor, CollaborationRecords } from '../../src/models/planning-collaboration/Collaboration.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The real createProject and removeMember, called as their callers call them, on in-memory branches. */
afterEach(() => vi.restoreAllMocks());
const [maya, jordan, priya, rin] = [
	['google-107342918560473829164', 'maya.chen@example.com', 'Maya Chen'],
	['google-112905671843029517384', 'jordan.lee@example.net', 'Jordan Lee'],
	['google-109223344556677889900', 'priya.nair@example.com', 'Priya Nair'],
	['google-111223344556677889911', 'rin.sato@example.com', 'Rin Sato']
].map(([id, email, name]): Actor => ({ id, email, name, emailVerified: true }));
const unverified = { ...jordan, emailVerified: false } as unknown as Actor;
// prettier-ignore
const repo = (id: number, name: string) => ({ id, owner: 'acme-labs', name, private: true, installationId: 51840213 });
const [checkoutRepo, mobileRepo] = [repo(918274, 'checkout-web'), repo(1047365, 'mobile-app')];
const checkoutId = '5b1e0f6a-3c2d-4e8f-9a7b-1c2d3e4f5a6b';
const mobileId = 'c3a9f1e2-7d64-4a85-b0c2-6e8f1d3a5b7c';
const [clockAt, laterAt] = ['2026-11-14T09:30:00.000Z', '2026-11-13T18:05:42.517Z'];
const revisionOf = (count: number) => count.toString(16).padStart(40, '0');
// prettier-ignore
const empty: CollaborationRecords = { schemaVersion: 1, projects: [], members: [], invitations: [], threads: [] };
// prettier-ignore
const project = (id: string, name: string, source: typeof checkoutRepo, owner: Actor) => ({ id, name, sourceRepository: source, createdAt: clockAt, ownerId: owner.id });
// prettier-ignore
const member = (projectId: string, who: Actor, role: 'owner' | 'writer') => ({ projectId, actorId: who.id, email: who.email, name: who.name, role });
// prettier-ignore
const invite = (n: number, projectId: string, email: string) => ({ id: `0f3e2d1c-1000-4000-8000-00000000000${n}`, projectId, expiresAt: '2026-12-01T00:00:00.000Z', codeHash: 'a'.repeat(64), email, role: 'writer' as const, acceptedBy: null });
/** Checkout redesign: Maya and Priya own it and Jordan writes. Mobile onboarding: Rin owns it alone. */
// prettier-ignore
const team: CollaborationRecords = {
	schemaVersion: 1,
	projects: [project(checkoutId, 'Checkout redesign', checkoutRepo, maya), project(mobileId, 'Mobile onboarding', mobileRepo, rin)],
	members: [member(checkoutId, maya, 'owner'), member(checkoutId, priya, 'owner'), member(checkoutId, jordan, 'writer'), member(mobileId, rin, 'owner')],
	invitations: [invite(1, checkoutId, jordan.email), invite(2, mobileId, jordan.email)],
	threads: []
};
function granted(_actor: Actor, repositoryId: number) {
	const found = [checkoutRepo, mobileRepo].find((r) => r.id === repositoryId);
	return found ? Promise.resolve(found) : Promise.reject(new Error('repository not granted'));
}
const copy = (r: CollaborationRecords) => JSON.parse(JSON.stringify(r)) as CollaborationRecords;
/** An in-memory records branch: it counts reads, writes and authorizations and can fail in named ways. */
// prettier-ignore
function branch(seed: CollaborationRecords, fault: { lostWrites?: number; readFails?: boolean; writeFails?: boolean; clock?: string; authorize?: typeof granted } = {}) {
	let records = copy(seed);
	let revision = 1;
	const counts = { reads: 0, writes: 0, authorizations: 0 };
	const clock = { at: new Date(fault.clock ?? clockAt) };
	const repository = {
		async read() {
			counts.reads += 1;
			if (fault.readFails) throw new Error('store unavailable');
			return { revision: revisionOf(revision), records: copy(records) };
		},
		async compareAndSwap(expected: string, next: CollaborationRecords) {
			counts.writes += 1;
			if (fault.writeFails) throw new Error('write channel closed');
			if (counts.writes <= (fault.lostWrites ?? 0) || expected !== revisionOf(revision)) return null;
			revision += 1;
			records = copy(next);
			return revisionOf(revision);
		}
	};
	const deps = {
		repository,
		source: {} as never,
		cache: {} as never,
		authorizeRepository: (who: Actor, id: number) => { counts.authorizations += 1; return (fault.authorize ?? granted)(who, id); },
		now: () => clock.at
	};
	return { deps, clock, counts, records: () => records, revision: () => revisionOf(revision) };
}
/** One call as a caller makes it: its output, or the error it raised with the fields that matter. */
// prettier-ignore
async function outcome(run: () => Promise<unknown>) {
	try { return { output: await run() }; } catch (error) { const e = error as Error & { code?: string }; return { error: { name: e.name, code: e.code, message: e.message } }; }
}
// prettier-ignore
async function creation(name: string, who: Actor, input: Parameters<typeof createProject>[2], fault: Parameters<typeof branch>[1] = {}) {
	const store = branch(empty, fault);
	const result = await outcome(() => createProject(store.deps, who, input));
	return { name, input: { actor: who, ...input, clock: fault.clock ?? clockAt }, result, store };
}
// prettier-ignore
async function removal(name: string, who: Actor, input: Parameters<typeof removeMember>[2], fault: Parameters<typeof branch>[1] = {}) {
	const store = branch(team, fault);
	const result = await outcome(() => removeMember(store.deps, who, input));
	return { name, input: { actor: who, ...input }, result, store };
}
/** What a removal leaves committed: no resolved value, then the members and invitations per project. */
// prettier-ignore
const after = (store: ReturnType<typeof branch>) => ({ value: null, members: store.records().members.map((m) => `${m.projectId}/${m.actorId}`),
	invitations: store.records().invitations.map((i) => `${i.projectId}/${i.email}`) });
// prettier-ignore
const where = (state: string, symbol: string) => ({ unitId: 'collaboration.function.create-project', symbol, state, evidence: 'examples-cases', file: `${state}.json` });
// prettier-ignore
const asCases = (runs: { name: string; input: object; result: Awaited<ReturnType<typeof outcome>> }[]) => runs.map(({ name, input, result }) => ({ name, input, ...result }));
test('createProject records a new project for its verified owner and returns it with the committed revision', async () => {
	const store = branch(empty);
	const signed = { ...maya, email: 'Maya.Chen@Example.com', name: '  Maya Chen ' };
	const first = { name: '  Checkout redesign  ', repositoryId: 918274 };
	const second = { name: 'Mobile onboarding', repositoryId: 1047365 };
	vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(checkoutId).mockReturnValueOnce(mobileId);
	const made = await outcome(() => createProject(store.deps, signed, first));
	store.clock.at = new Date(laterAt);
	const later = await outcome(() => createProject(store.deps, jordan, second));
	// prettier-ignore
	recordExampleCases(where('createproject-records-a-new-project-for-its-verified-owner-a', 'createProject'), [
		{ name: 'Maya Chen starts Checkout redesign with a padded name', input: { actor: signed, ...first, clock: clockAt }, ...made },
		{ name: 'Jordan Lee starts Mobile onboarding a day later', input: { actor: jordan, ...second, clock: laterAt }, ...later }
	]);
	// prettier-ignore
	expect(made.output).toMatchObject({ id: checkoutId, sourceRepository: checkoutRepo, ownerId: maya.id, role: 'owner', collaborationCommit: revisionOf(2) });
	// prettier-ignore
	expect(later.output).toMatchObject({ id: mobileId, createdAt: laterAt, collaborationCommit: revisionOf(3) });
	const [mine, theirs] = store.records().members;
	expect(mine).toMatchObject({ email: maya.email, name: maya.name, role: 'owner' });
	expect(theirs).toMatchObject({ actorId: jordan.id, role: 'owner' });
	expect(store.counts).toEqual({ reads: 2, writes: 2, authorizations: 2 });
});
test('createProject refuses an extra key, an unverified actor, an unauthorized repository or an invalid clock, and adds no project', async () => {
	const checkout = { name: 'Checkout redesign', repositoryId: 918274 };
	const extra = { ...checkout, visibility: 'public' };
	const rejects = () => Promise.reject(new Error('no grant'));
	const runs = await Promise.all([
		creation('an extra key is invalid input', maya, extra),
		creation('an unverified actor is refused before any read', unverified, checkout),
		creation('authorization rejects the repository', maya, checkout, { authorize: rejects }),
		creation('an invalid clock is a RangeError', maya, checkout, { clock: 'not a date' })
	]);
	// prettier-ignore
	recordExampleCases(where('createproject-refuses-an-extra-key-an-unverified-actor-an-un', 'createProject'), asCases(runs));
	// prettier-ignore
	expect(runs.map(({ result }) => result.error?.code ?? result.error?.name).join(' ')).toBe('invalid-input invalid-input forbidden RangeError');
	// prettier-ignore
	expect(runs.map(({ store: { counts: c } }) => `${c.reads}/${c.authorizations}/${c.writes}`).join(' ')).toBe('0/0/0 0/0/0 1/1/0 1/1/0');
	expect(runs.flatMap(({ store }) => store.records().projects)).toEqual([]);
});
test('createProject retries a lost write, fails with conflict after five lost writes and passes repository errors through', async () => {
	const input = { name: 'Checkout redesign', repositoryId: 918274 };
	vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(checkoutId);
	// prettier-ignore
	const [retried, jammed, unreadable, unwritable] = await Promise.all([
		creation('one lost write is retried against the next revision', maya, input, { lostWrites: 1 }),
		creation('five lost writes in a row fail with conflict', maya, input, { lostWrites: 5 }),
		creation('a records read that rejects passes its error through', maya, input, { readFails: true }),
		creation('a records write that rejects passes its error through', maya, input, { writeFails: true })
	]);
	// prettier-ignore
	recordExampleCases(where('createproject-retries-a-lost-write-fails-with-conflict-after', 'createProject'), asCases([retried, jammed, unreadable, unwritable]));
	expect(retried.result.output).toMatchObject({ collaborationCommit: revisionOf(2) });
	expect(retried.store.counts).toEqual({ reads: 2, writes: 2, authorizations: 2 });
	expect(jammed.result.error?.code).toBe('conflict');
	expect(jammed.store.counts).toEqual({ reads: 5, writes: 5, authorizations: 5 });
	expect(unreadable.result.error).toEqual({ name: 'Error', message: 'store unavailable' });
	expect(unwritable.result.error).toEqual({ name: 'Error', message: 'write channel closed' });
});
test('removeMember lets an owner remove a writer and then a co-owner, and refuses the sole owner of a project', async () => {
	const store = branch(team);
	const values: unknown[] = [];
	// prettier-ignore
	const drop = (memberId: string) => outcome(async () => {
		values.push(await removeMember(store.deps, maya, { projectId: checkoutId, memberId }));
		return after(store);
	});
	const removedJordan = await drop(jordan.id);
	const removedPriya = await drop(priya.id);
	const ownRemoval = { projectId: mobileId, memberId: rin.id };
	const soleOwner = await outcome(() => removeMember(store.deps, rin, ownRemoval));
	// prettier-ignore
	recordExampleCases(where('removemember-lets-an-owner-remove-a-writer-and-then-a-co-own', 'removeMember'), [
		{ name: 'owner Maya Chen removes writer Jordan Lee from Checkout redesign', input: { actor: maya, projectId: checkoutId, memberId: jordan.id }, ...removedJordan },
		{ name: 'owner Maya Chen removes co-owner Priya Nair while another owner remains', input: { actor: maya, projectId: checkoutId, memberId: priya.id }, ...removedPriya },
		{ name: 'owner Rin Sato removes herself as the only owner of Mobile onboarding', input: { actor: rin, ...ownRemoval }, ...soleOwner }
	]);
	expect(values).toEqual([undefined, undefined]);
	expect(removedJordan.output).toMatchObject({ invitations: [`${mobileId}/${jordan.email}`] });
	// prettier-ignore
	expect(removedPriya.output).toMatchObject({ members: [`${checkoutId}/${maya.id}`, `${mobileId}/${rin.id}`] });
	expect(soleOwner.error?.code).toBe('sole-owner');
	expect(store.revision()).toBe(revisionOf(3));
	expect(store.counts).toEqual({ reads: 3, writes: 2, authorizations: 0 });
});
test('removeMember refuses non-owners, strangers, unknown members and five lost writes, and removes nobody', async () => {
	const fromCheckout = { projectId: checkoutId, memberId: jordan.id };
	// prettier-ignore
	const runs = await Promise.all([
		removal('a writer cannot remove an owner', jordan, { ...fromCheckout, memberId: maya.id }),
		removal('a stranger with no membership is forbidden', rin, fromCheckout),
		removal('an unknown member is not found', maya, { ...fromCheckout, memberId: 'google-100000000000000000000' }),
		removal('five lost writes in a row fail with conflict', maya, fromCheckout, { lostWrites: 5 })
	]);
	// prettier-ignore
	recordExampleCases(where('removemember-refuses-non-owners-strangers-unknown-members-an', 'removeMember'), asCases(runs));
	// prettier-ignore
	expect(runs.map(({ result }) => result.error?.code).join(' ')).toBe('forbidden forbidden not-found conflict');
	// prettier-ignore
	expect(runs.map(({ store: { counts: c } }) => `${c.reads}/${c.writes}`).join(' ')).toBe('1/0 1/0 1/0 5/5');
	expect(runs.map(({ store }) => store.revision())).toEqual(runs.map(() => revisionOf(1)));
});
test('removeMember refuses a malformed project ID and an unverified actor as invalid input', async () => {
	const fromCheckout = { projectId: checkoutId, memberId: jordan.id };
	const notUuid = { ...fromCheckout, projectId: 'not-a-uuid' };
	const runs = await Promise.all([
		removal('a project ID that is not a UUID is refused', maya, notUuid),
		removal('an unverified actor is refused after the read', unverified, fromCheckout)
	]);
	// prettier-ignore
	recordExampleCases(where('removemember-refuses-a-malformed-project-id-and-an-unverifie', 'removeMember'), asCases(runs));
	const codes = runs.map(({ result }) => result.error?.code).join(' ');
	expect(codes).toBe('invalid-input invalid-input');
	const counts = runs.map(({ store: { counts: c } }) => `${c.reads}/${c.writes}`).join(' ');
	expect(counts).toBe('0/0 1/0');
});
