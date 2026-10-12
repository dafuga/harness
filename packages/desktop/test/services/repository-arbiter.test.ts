import { expect, test } from 'vitest';
import { RepositoryArbiterService } from '../../src/services/RepositoryArbiterService';

test('one owner holds the run lock of a repository at a time', () => {
	const arbiter = new RepositoryArbiterService(),
		a = {},
		b = {};
	expect(arbiter.hold('/one', a)).toBe(true);
	expect(arbiter.hold('/one', b)).toBe(false);
	expect(arbiter.hold('/one', a)).toBe(true);
	expect(arbiter.hold('/two', b)).toBe(true);
	expect(arbiter.held('/one')).toBe(true);
	expect(arbiter.held('/three')).toBe(false);
	expect(arbiter.held(null)).toBe(false);
	arbiter.release('/one', b);
	expect(arbiter.held('/one')).toBe(true);
	arbiter.release('/one', a);
	expect(arbiter.held('/one')).toBe(false);
	expect(arbiter.hold('/one', b)).toBe(true);
});
test('writes of one repository run one at a time, in order, and survive a failure', async () => {
	const arbiter = new RepositoryArbiterService(),
		order: string[] = [];
	const work =
		(name: string, fail = false) =>
		async () => {
			order.push('start ' + name);
			await new Promise((resolve) => setTimeout(resolve, 5));
			order.push('end ' + name);
			if (fail) throw new Error(name);
			return name;
		};
	const results = await Promise.allSettled([
		arbiter.exclusive('/one', work('a')),
		arbiter.exclusive('/one', work('b', true)),
		arbiter.exclusive('/one', work('c')),
		arbiter.exclusive('/two', work('other'))
	]);
	expect(results.map((result) => result.status)).toEqual([
		'fulfilled',
		'rejected',
		'fulfilled',
		'fulfilled'
	]);
	const one = order.filter((entry) => !entry.endsWith('other'));
	expect(one).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
	expect(order.indexOf('start other')).toBeLessThan(order.indexOf('end a'));
});
