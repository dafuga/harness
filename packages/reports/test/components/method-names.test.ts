import { expect, test } from 'vitest';
import {
	methodsNamed,
	orderedMethods,
	within
} from '../../src/components/explorer-ui/entity-contract/methodNames';

test('a name is within a class when declared under it, or is the class itself when whole', () => {
	expect(within('Svc.run.input', 'Svc', false)).toBe(true);
	expect(within('Svc', 'Svc', false)).toBe(false);
	expect(within('Svc', 'Svc', true)).toBe(true);
	expect(within('Other.run', 'Svc', true)).toBe(false);
});

test('methods named by a class are read from member names, a bare method only when whole', () => {
	const names = ['Svc.run.input', 'Svc.stop', 'Svc', 'Other.x.y'];
	expect(methodsNamed(names, 'Svc', false)).toEqual(['run']);
	expect(methodsNamed(names, 'Svc', true)).toEqual(['run', 'stop']);
});

test('create, read, update and delete come first and construction last, once each', () => {
	const given = ['zeta', 'delete', 'constructor', 'create', 'update', 'read', 'zeta'];
	expect(orderedMethods(given)).toEqual([
		'create',
		'read',
		'update',
		'delete',
		'constructor',
		'zeta'
	]);
});
