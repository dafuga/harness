import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { expect, test } from 'vitest';

const directory = join(
	import.meta.dirname,
	'../../../..',
	JSON.parse(
		readFileSync(
			join(
				import.meta.dirname,
				'../../../../specification/units/reports.component.harness-explorer-content.json'
			),
			'utf8'
		)
	).runtime.entry,
	'..'
);
const registry = join(import.meta.dirname, '../../../../specification/units');
const owned = new Set(
	readdirSync(registry)
		.filter((name) => name.endsWith('.json'))
		.flatMap((name) => {
			const unit = JSON.parse(readFileSync(join(registry, name), 'utf8'));
			return unit.status === 'active' && unit.id.startsWith('reports.component.harness-')
				? unit.owns.source.map((path: string) => basename(path))
				: [];
		})
);
/**
 * Keys that are unique by construction: a position, a member of a set, a constant, or the
 * identity of a registry unit, scenario, revision, record, report or deduplicated edge.
 */
const unique = new Set([
	'position',
	'id',
	'key',
	'name',
	'metric',
	'unit.id',
	'node.unit.id',
	'scenario.id',
	'item.id',
	'item.commit',
	'report.id',
	"edge.from + '>' + edge.to",
	// An explorer list of entities is keyed by the entity, and a history by its commit.
	'row.id',
	'row.key',
	'row.commit',
	'group.id',
	'group.name',
	'token.name'
]);

test('console lists are keyed only by what cannot repeat, never by recorded text', () => {
	const keyed: Array<[string, string]> = [];
	for (const file of readdirSync(directory).filter(
		(name) => name.endsWith('.svelte') && owned.has(name)
	)) {
		const source = readFileSync(join(directory, file), 'utf8');
		// The key is the last parenthesised part; the list expression before it may hold calls.
		for (const block of source.matchAll(/\{#each\s[^}]*\(([^()]*)\)\}/g)) {
			keyed.push([file, block[1].trim()]);
		}
	}
	expect(keyed.length).toBeGreaterThan(30);
	// A key built from a symbol, a behaviour, a failure or a path repeats as soon as two
	// records say the same thing, and one repeated key stops the whole view from rendering.
	expect(keyed.filter(([, key]) => !unique.has(key))).toEqual([]);
});
