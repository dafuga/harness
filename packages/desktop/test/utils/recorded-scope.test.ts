import { expect, test } from 'vitest';
import { recordedScope } from '../../src/utils/recordedScope';
import { head, home, parent } from '../recorded-sample';

const at = '2026-10-01T00:00:00.000Z';
const query = { entityId: home, commit: head, branch: 'main', mode: 'commit' as const };
const facts = {
	tip: head,
	kind: 'page' as string | undefined,
	revision: {
		commit: head,
		parents: [parent, 'c'.repeat(40)],
		subject: 'feat: sample',
		author: 'Sample',
		committedAt: at
	},
	judged: { coverage: 'verified' as const, gaps: [], records: [] },
	legacy: ['legacy-1']
};

test('a commit is shown beside its first parent, on the branch that was selected', () => {
	const scope = recordedScope(query, facts);
	expect(scope).toEqual({
		location: { branch: 'main', commit: head, category: 'pages', entity: home },
		mode: 'commit',
		branch: 'main',
		tip: head,
		commit: head,
		atTip: true,
		parent,
		summary: {
			...facts.revision,
			...facts.judged,
			branches: ['main'],
			retained: false,
			legacy: ['legacy-1']
		}
	});
	const inside = recordedScope(query, { ...facts, tip: 'e'.repeat(40) });
	expect([inside.atTip, inside.tip, inside.location.commit]).toEqual([false, 'e'.repeat(40), head]);
	const root = recordedScope(query, { ...facts, revision: { ...facts.revision, parents: [] } });
	expect(root.parent).toBeNull();
});

test('the tip is addressed by its branch alone, and only while it is the tip', () => {
	const current = { ...query, mode: 'current' as const };
	expect(recordedScope(current, facts)).toMatchObject({
		location: { branch: 'main', commit: null },
		mode: 'current',
		atTip: true,
		parent
	});
	expect(() => recordedScope(current, { ...facts, tip: 'e'.repeat(40) })).toThrow(
		/no longer the tip of branch main/
	);
});

test('an entity that is not registered, or is of no listed category, is refused', () => {
	expect(() => recordedScope(query, { ...facts, kind: undefined })).toThrow(/not registered/);
	expect(() => recordedScope(query, { ...facts, kind: 'rule' })).toThrow(/not registered/);
	expect(recordedScope(query, { ...facts, kind: 'service' }).location.category).toBe('services');
});
