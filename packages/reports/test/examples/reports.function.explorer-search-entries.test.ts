import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { explorerEntities } from '../../src/utils/explorer-ui/explorerEntities';
import { explorerSearchEntries } from '../../src/utils/explorer-ui/explorerSearchEntries';
import type { ExplorerEntity } from '../../src/models/explorer-ui/Explorer.types';
import type { HarnessRevision, HarnessUnit } from '../../src/models/explorer-ui/Harness.types';
import { revision, sha, unit } from '../explorerFixture';

type Cases = Parameters<typeof recordExampleCases>[1];
const unitId = 'reports.function.explorer-search-entries';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{
			unitId,
			symbol: 'explorerSearchEntries',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);

const field = (name: string) => ({ name, type: 'string' });
const contract = (inputs: string[], outputs: string[], errors: string[]) => ({
	inputs: inputs.map(field),
	outputs: outputs.map(field),
	errors: errors.map(field)
});
const shown = [
	unit('app.page.orders', 'page', { title: 'Orders' }),
	unit('app.function.format-time', 'function', {
		title: 'formatTime',
		contract: contract(['placedAt', 'zone'], ['elapsed'], ['in-future'])
	}),
	unit('app.service.refunds', 'service', {
		title: 'Refund service',
		contract: contract(['orderId'], [], ['refused'])
	})
];
const gone = unit('app.config.gone', 'config', {
	title: 'Gone config',
	contract: contract(['secretKey'], [], [])
});
const removed = (units: HarnessUnit[]) => ({
	base: sha('b'),
	expanded: false,
	units: { direct: [], indirect: [], added: [], removed: units.map((item) => item.id) },
	scenarios: [],
	uncertain: [],
	changed: []
});
const parent = revision([...shown, gone], [], [], { commit: sha('b') });
const head = revision(shown, [], [], { commit: sha('a'), sourceImpact: removed([gone]) });
const entitiesOf = (current: HarnessRevision, before: HarnessRevision | null = parent) =>
	explorerEntities(current, before);

/** The name of what a call threw, or a note that it returned; the call is made once. */
function thrownName(call: () => unknown): string {
	try {
		call();
	} catch (error) {
		return (error as Error).constructor.name;
	}
	return 'nothing thrown';
}

test('Entries keep the displayed order and contract terms in inputs, outputs, errors order', () => {
	const entities = entitiesOf(head);
	const entries = explorerSearchEntries(entities, sha('a'));
	const expectedIds = entities.filter((entity) => entity.change !== 'removed').map((e) => e.id);
	expect(entries.map((entry) => entry.id)).toEqual(expectedIds);
	expect(entries).toHaveLength(shown.length);
	expect(entries.find((entry) => entry.id === 'app.function.format-time')).toEqual({
		id: 'app.function.format-time',
		category: 'functions',
		name: 'formatTime',
		purpose: 'What app.function.format-time is for.',
		terms: ['placedAt', 'zone', 'elapsed', 'in-future'],
		commit: sha('a')
	});
	record('entries-keep-order-and-contract-terms', [
		{ name: 'displayed revision at commit a', input: 'entities of head', output: entries }
	]);
});

test('Removed units are dropped and no source path reaches an entry', () => {
	const entities = entitiesOf(head);
	const goneEntity = entities.find((entity) => entity.id === 'app.config.gone');
	expect(goneEntity?.change).toBe('removed');
	const entries = explorerSearchEntries(entities, sha('a'));
	expect(entries.map((entry) => entry.id)).not.toContain('app.config.gone');
	expect(JSON.stringify(entries)).not.toContain('secretKey');
	expect(JSON.stringify(entries)).not.toContain('src/');
	record('removed-units-are-dropped-and-no-path-leaks', [
		{
			name: 'parent held a removed config unit',
			input: 'entities of head with parent',
			output: entries
		}
	]);
});

test('The given commit is copied onto each entry without a format check', () => {
	const entities = entitiesOf(head);
	const malformed = explorerSearchEntries(entities, 'not-a-commit');
	const short = explorerSearchEntries(entities, '1234');
	expect(malformed.every((entry) => entry.commit === 'not-a-commit')).toBe(true);
	expect(short.every((entry) => entry.commit === '1234')).toBe(true);
	expect(malformed.map((entry) => entry.id)).toEqual(short.map((entry) => entry.id));
	record('commit-is-copied-unchecked', [
		{ name: 'malformed commit text', input: 'not-a-commit', output: malformed },
		{ name: 'short commit text', input: '1234', output: short }
	]);
});

test('No entries when no entity is given or every entity was removed', () => {
	const none = explorerSearchEntries([], sha('a'));
	const emptyHead = revision([], [], [], {
		commit: sha('a'),
		sourceImpact: removed([gone])
	});
	const onlyRemoved = entitiesOf(emptyHead);
	expect(onlyRemoved.map((entity) => entity.change)).toEqual(['removed']);
	const allRemoved = explorerSearchEntries(onlyRemoved, sha('a'));
	expect(none).toEqual([]);
	expect(allRemoved).toEqual([]);
	record('empty-when-nothing-is-shown', [
		{ name: 'no entities given', input: [], output: none },
		{ name: 'only a removed unit given', input: 'entities of emptyHead', output: allRemoved }
	]);
});

test('A shown entity without a readable contract throws, and a removed one is never read', () => {
	const [first] = entitiesOf(head);
	const broken = {
		...first,
		unit: { ...first.unit, contract: undefined }
	} as unknown as ExplorerEntity;
	const noErrors = {
		...first,
		unit: { ...first.unit, contract: { inputs: [], outputs: [] } }
	} as unknown as ExplorerEntity;
	const goneEntity = entitiesOf(head).find(
		(entity) => entity.change === 'removed'
	) as ExplorerEntity;
	const brokenGone = {
		...goneEntity,
		unit: { ...goneEntity.unit, contract: undefined }
	} as unknown as ExplorerEntity;
	const missing = thrownName(() => explorerSearchEntries([broken], sha('a')));
	const missingErrors = thrownName(() => explorerSearchEntries([noErrors], sha('a')));
	const removedSkipped = explorerSearchEntries([brokenGone], sha('a'));
	expect(missing).toBe('TypeError');
	expect(missingErrors).toBe('TypeError');
	expect(removedSkipped).toEqual([]);
	record('missing-contract-reads-throw', [
		{ name: 'shown unit with no contract', input: first.id, error: missing },
		{ name: 'shown unit with no errors list', input: first.id, error: missingErrors },
		{ name: 'removed unit with no contract', input: goneEntity.id, output: removedSkipped }
	]);
});
