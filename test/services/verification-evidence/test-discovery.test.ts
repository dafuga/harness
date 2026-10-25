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
	const tree = {
		read: async (file: string) => {
			if (file === 'missing') throw new Error('missing');
			return `import { test } from 'vitest'; test.each([1])('row %i', () => {});`;
		}
	};
	const result = await service.discover(tree, ['present', 'missing']);
	expect(result.tests).toHaveLength(1);
	expect(result.errors).toEqual([
		'Cannot read test declarations: missing',
		'present:1: computed case requires runner discovery'
	]);
});
