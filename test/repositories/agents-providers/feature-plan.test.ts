import { expect, test } from 'vitest';
import { FeaturePlanRepository } from '../../../src/repositories/agents-providers/FeaturePlanRepository';

test('FeaturePlanRepository.find from empty initialization returns missing', () => {
	const repository = new FeaturePlanRepository();
	// => undefined
	expect(repository.find(1)).toBeUndefined();
});

test('FeaturePlanRepository.find from populated initialization returns matching and missing records', () => {
	const repository = new FeaturePlanRepository();
	const record = { id: 1 };
	repository.save(record);
	// => { id: 1 }
	expect(repository.find(record.id)).toBe(record);
	// => undefined
	expect(repository.find(2)).toBeUndefined();
});

test('FeaturePlanRepository.save from empty initialization stores valid records and rejects invalid records', () => {
	const repository = new FeaturePlanRepository();
	const record = { id: 1 };
	// => { id: 1 }
	expect(repository.save(record)).toBe(record);
	expect(repository.find(record.id)).toBe(record);
	// throws TypeError
	expect(() => new FeaturePlanRepository().save(null as never)).toThrow(TypeError);
});

test('FeaturePlanRepository.save from populated initialization replaces valid records and rejects invalid records', () => {
	const original = { id: 1, label: 'original' };
	const repository = new FeaturePlanRepository<typeof original>();
	repository.save(original);
	const replacement = { id: 1, label: 'replacement' };
	// => { id: 1, label: 'replacement' }
	expect(repository.save(replacement)).toBe(replacement);
	expect(repository.find(replacement.id)).toBe(replacement);
	// throws TypeError
	expect(() => repository.save(null as never)).toThrow(TypeError);
	expect(repository.find(replacement.id)).toBe(replacement);
});

function plan(revision = 1) {
	return {
		feature: 'checkout',
		sourceCommit: 'a'.repeat(40),
		revision,
		goal: 'Review checkout',
		tldr: 'Build checkout',
		pages: [],
		changes: [],
		tasks: [],
		digest: String(revision).repeat(64)
	};
}

function queueFixture() {
	let data: {
		schemaVersion: 1;
		features: never[];
		tasks: never[];
		plans?: (ReturnType<typeof plan> & { approval?: { reviewer: string; approvedAt: string } })[];
	} = { schemaVersion: 1, features: [], tasks: [] };
	let commit: string | undefined;
	const drafts: (typeof data)[] = [];
	return {
		drafts,
		async read() {
			return { commit, data: structuredClone(data) };
		},
		async update<T>(change: (draft: typeof data) => T) {
			const draft = structuredClone(data);
			const value = change(draft);
			if (JSON.stringify(draft) !== JSON.stringify(data)) {
				drafts.push(structuredClone(draft));
				data = structuredClone(draft);
				commit = `queue-${drafts.length}`;
			}
			return { value, commit };
		}
	};
}

const approval = {
	feature: 'checkout',
	revision: 1,
	digest: '1'.repeat(64),
	reviewer: 'reviewer@example.test',
	approvedAt: '2026-10-26T12:00:00.000Z'
};

test('FeaturePlanRepository.read returns legacy empty and ordered feature revisions', async () => {
	const queue = queueFixture();
	const repository = new FeaturePlanRepository('/unused-feature-plans', queue);
	expect(await repository.read('checkout')).toEqual({ commit: undefined, plans: [] });
	await repository.append(plan());
	await repository.append(plan(2));
	await repository.append({ ...plan(), feature: 'other-feature' });
	expect(await repository.read('checkout')).toEqual({
		commit: 'queue-3',
		plans: [plan(), plan(2)]
	});
	expect(await repository.read('missing')).toEqual({ commit: 'queue-3', plans: [] });
	expect(queue.drafts[0]?.plans).toEqual([plan()]);
	expect(queue.drafts[1]?.plans).toEqual([plan(), plan(2)]);
});

test('FeaturePlanRepository.append persists immutable sequential revisions and rejects invalid definitions', async () => {
	const queue = queueFixture();
	const repository = new FeaturePlanRepository('/unused-feature-plans', queue);
	const first = plan();
	expect(await repository.append(first)).toEqual({ commit: 'queue-1', plan: first });
	first.goal = 'Caller mutation';
	expect(await repository.append(plan())).toEqual({ commit: 'queue-1', plan: plan() });
	expect(await repository.append(plan(2))).toEqual({ commit: 'queue-2', plan: plan(2) });
	const before = await queue.read();
	for (const invalid of [
		{ ...plan(2), digest: 'f'.repeat(64) },
		{ ...plan(2), goal: 'Conflicting content' },
		{ ...plan(), goal: 'Stale content' },
		plan(4),
		plan(0),
		{ ...plan(3), digest: 'bad' },
		{ ...plan(3), approval: { reviewer: approval.reviewer, approvedAt: approval.approvedAt } }
	]) {
		await expect(repository.append(invalid)).rejects.toThrow();
		expect(await queue.read()).toEqual(before);
		expect(queue.drafts).toHaveLength(2);
	}
	expect(queue.drafts[0]?.plans).toEqual([plan()]);
	expect(await repository.read('checkout')).toEqual({
		commit: 'queue-2',
		plans: [plan(), plan(2)]
	});
});

test('FeaturePlanRepository.approve binds latest exact digest and is idempotent without mutation on rejection', async () => {
	const queue = queueFixture();
	const repository = new FeaturePlanRepository('/unused-feature-plans', queue);
	await expect(repository.approve(approval)).rejects.toThrow();
	expect(await queue.read()).toEqual({
		commit: undefined,
		data: { schemaVersion: 1, features: [], tasks: [] }
	});
	await repository.append(plan());
	await repository.append(plan(2));
	const latest = { ...approval, revision: 2, digest: plan(2).digest };
	const before = await queue.read();
	for (const invalid of [
		approval,
		{ ...latest, digest: approval.digest },
		{ ...latest, feature: 'missing' }
	]) {
		await expect(repository.approve(invalid)).rejects.toThrow();
		expect(await queue.read()).toEqual(before);
	}
	const approved = {
		...plan(2),
		approval: { reviewer: approval.reviewer, approvedAt: approval.approvedAt, digest: latest.digest }
	};
	expect(await repository.approve(latest)).toEqual({ commit: 'queue-3', plan: approved });
	expect(await repository.approve(latest)).toEqual({ commit: 'queue-3', plan: approved });
	const after = await queue.read();
	for (const invalid of [
		{ ...latest, reviewer: 'different@example.test' },
		{ ...latest, approvedAt: '2026-10-27T12:00:00.000Z' }
	]) {
		await expect(repository.approve(invalid)).rejects.toThrow();
		expect(await queue.read()).toEqual(after);
	}
	expect(queue.drafts).toHaveLength(3);
	expect(queue.drafts[1]?.plans).toEqual([plan(), plan(2)]);
	expect(await repository.read('checkout')).toEqual({
		commit: 'queue-3',
		plans: [plan(), approved]
	});
});
