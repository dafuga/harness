import { expect, test, vi } from 'vitest';
import { nativeScope } from '../../src/components/native-approval/nativeScope';

test('the requested scope is said in words before anything is approved', async () => {
	const get = vi.fn(async () => ({ name: 'Atlas' }) as never);
	expect(await nativeScope('projects', { get })).toMatch(/every shared project you can open/);
	expect(get).not.toHaveBeenCalled();
	expect(await nativeScope('project:6f1d2c3b', { get })).toBe('the project “Atlas” only');
	expect(get).toHaveBeenCalledWith('6f1d2c3b');
});

test('a scope that cannot be read is never understated', async () => {
	const get = vi.fn(async () => {
		throw new Error('forbidden');
	});
	expect(await nativeScope(null, { get })).toMatch(/every shared project you can open/);
	expect(await nativeScope('project:other', { get })).toBe(
		'one project that this account cannot open'
	);
});
