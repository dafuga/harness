import { expect, test } from 'vitest';
import { TestDiscoveryService } from '../../../src/services/verification-evidence/TestDiscoveryService';

const service = new TestDiscoveryService();
test('scan initialized source finds imported cases, aliases and computed registration', () => {
	const found = service.scan(
		`import { test as check } from 'vitest'; check('ready', () => {}); check.skip('missing', () => {}); check.each([1, 2])('row %i', () => {});`,
		'test/service.test.ts'
	);
	expect(found.map((item) => [item.title, item.dynamic, item.disabled])).toEqual([
		['ready', false, false],
		['missing', false, true],
		['row %i', true, false]
	]);
	expect(service.scan(`const test = () => {}; test('ordinary call');`, 'src/service.ts')).toEqual(
		[]
	);
});

test('discover initialized and unreadable sources retain explicit discovery gaps', async () => {
	const original = (await import('../../../specification/units/function.case.json')).default;
	const manifest = {
		...original,
		helperContracts: [],
		testing: {
			version: 1,
			shape: 'helper',
			states: ['initialized'],
			examples: [
				{
					subject: 'finish',
					name: 'Finish',
					call: 'finish()',
					input: [],
					expected: { kind: 'void' }
				}
			],
			cases: [
				{
					id: 'finish',
					state: 'initialized',
					subject: 'finish',
					example: 'Finish',
					test: { file: 'test/examples.test.ts', title: 'finish: Finish' }
				}
			]
		}
	};
	const tree = {
		read: async (file: string) => {
			if (file === 'missing') throw new Error('missing');
			if (file === 'test/unit.json') return JSON.stringify(manifest);
			if (file === 'test/examples.test.ts')
				return `import { test } from 'vitest'; import unit from './unit.json'; new TestExpectationService().registerExamples(test, unit, { finish: () => undefined });`;
			return `import { test } from 'vitest'; test.each([1])('row %i', () => {});`;
		}
	};
	const result = await service.discover(tree, ['present', 'missing', 'test/examples.test.ts']);
	expect(result.tests).toHaveLength(2);
	expect(result.tests[1]).toMatchObject({
		title: 'finish: Finish',
		dynamic: false,
		disabled: false
	});
	expect(result.errors).toEqual([
		'Cannot read test declarations: missing',
		'present:1: computed case requires runner discovery'
	]);
});
