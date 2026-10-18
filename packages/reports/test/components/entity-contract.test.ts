import { expect, test } from 'vitest';
import { content, words } from '../entityRender';
import { record, revision } from '../entityFixture';
import { commits, ids } from '../entityUnits';

const route = { category: 'components' as const, entity: ids.list, tab: 'contract' as const };
test('a dedicated contract exposes types and declared examples without displaying source files', () => {
	for (const mode of ['current', 'commit'] as const) {
		const commit = mode === 'current' ? commits.tip : commits.middle;
		const head = revision(commit, [record(commit)]);
		head.registry.units = head.registry.units.map((unit) =>
			unit.id !== ids.list
				? unit
				: {
						...unit,
						contract: {
							inputs: [
								{
									name: 'enabled',
									type: 'boolean',
									description: 'Whether the list is active.',
									examples: [false]
								},
								{ name: 'limit', type: 'number', examples: [0] },
								{ name: 'empty', type: 'unknown', examples: [null] },
								{ name: 'settings', type: 'object', examples: [{ label: 'Safe <tag>' }] }
							],
							outputs: [{ name: 'count', type: 'number', examples: [2] }],
							errors: []
						}
					}
		);
		const body = content(mode, route, { head });
		for (const text of ['boolean', 'number', 'false', '0', 'null', 'Whether the list is active.'])
			expect(words(body)).toContain(text);
		expect(words(body)).toMatch(/Safe &lt;tag(?:&gt;|>)/);
		expect(body).not.toContain('<tag>');
		expect(body).not.toMatch(/src\/|\.svelte\b/);
	}
});

test('legacy contracts get labelled illustrative primitive examples and explicit gaps for opaque types', () => {
	const head = revision(commits.tip, [record(commits.tip)]);
	head.registry.units = head.registry.units.map((unit) =>
		unit.id !== ids.list
			? unit
			: {
					...unit,
					contract: {
						inputs: [
							{ name: 'label', type: 'string' },
							{ name: 'context', type: 'PrivateContext' }
						],
						outputs: [{ name: 'rows', type: 'string[]' }],
						errors: []
					}
				}
	);
	const body = words(content('current', route, { head }));
	expect(body).toContain('Illustrative');
	expect(body).toContain('Example not recorded');
	expect(body).toContain('PrivateContext');
});
