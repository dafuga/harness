import { expect, test } from 'vitest';
import { revisionChanges } from '../../src/services/history-index-service/revisionChanges';

const parent = 'b'.repeat(40);
const registry = (versions: Record<string, string>, available = true) => ({
	available,
	units: Object.entries(versions).map(([id, version]) => ({ id, version }))
});
const impact = (units: Partial<Record<'direct' | 'indirect' | 'added' | 'removed', string[]>>) => ({
	base: parent,
	units: { direct: [], indirect: [], added: [], removed: [], ...units }
});

test('a commit changes the units whose own source the stored impact names, and not what only depends on them', () => {
	const changes = revisionChanges({
		impact: impact({ direct: ['function.slugify'], indirect: ['service.title', 'page.titles'] }),
		registry: registry({ 'function.slugify': 'v2', 'service.title': 'v1' }),
		parent: registry({ 'function.slugify': 'v1', 'service.title': 'v1' })
	});
	expect(changes).toEqual({ base: parent, direct: ['function.slugify'], added: [], removed: [] });
});

test('a contract or dependency edit changes the version of a unit and is a change of it', () => {
	const changes = revisionChanges({
		impact: impact({ direct: ['function.slugify'] }),
		registry: registry({ 'function.slugify': 'v2', 'config.titles': 'c2', 'function.clock': 'k1' }),
		parent: registry({ 'function.slugify': 'v1', 'config.titles': 'c1', 'function.clock': 'k1' })
	});
	expect(changes?.direct).toEqual(['config.titles', 'function.slugify']);
});

test('a unit that appears or goes is added or removed, once, and never also changed', () => {
	const changes = revisionChanges({
		impact: impact({
			added: ['function.extra'],
			removed: ['function.old'],
			direct: ['function.extra']
		}),
		registry: registry({ 'function.extra': 'e1', 'function.new': 'n1' }),
		parent: registry({ 'function.old': 'o1', 'function.gone': 'g1' })
	});
	expect(changes).toEqual({
		base: parent,
		direct: [],
		added: ['function.extra', 'function.new'],
		removed: ['function.gone', 'function.old']
	});
});

test('a first commit has no base and adds everything it holds', () => {
	const changes = revisionChanges({
		impact: { base: null, units: { direct: [], indirect: [], added: ['function.a'], removed: [] } },
		registry: registry({ 'function.a': 'a1' }),
		parent: undefined
	});
	expect(changes).toEqual({ base: null, direct: [], added: ['function.a'], removed: [] });
});

test('versions alone say what changed when no impact was stored', () => {
	const changes = revisionChanges({
		impact: null,
		base: parent,
		registry: registry({ 'function.a': 'a2', 'function.b': 'b1' }),
		parent: registry({ 'function.a': 'a1', 'function.b': 'b1' })
	});
	expect(changes).toEqual({ base: parent, direct: ['function.a'], added: [], removed: [] });
});

test('nothing is claimed where neither the impact nor both registries are there', () => {
	const held = registry({ 'function.a': 'a1' });
	expect(revisionChanges({ impact: null, registry: held, parent: undefined })).toBeNull();
	expect(revisionChanges({ impact: null, registry: registry({}, false), parent: held })).toBeNull();
	expect(revisionChanges({ impact: null, registry: held, parent: registry({}, false) })).toBeNull();
	// An impact that was stored is used even when the registries cannot add to it.
	const stored = revisionChanges({
		impact: impact({ direct: ['function.a'] }),
		registry: registry({}, false),
		parent: undefined
	});
	expect(stored).toEqual({ base: parent, direct: ['function.a'], added: [], removed: [] });
});
