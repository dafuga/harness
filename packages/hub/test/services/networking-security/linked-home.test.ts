import { expect, test, vi } from 'vitest';
import { LinkedHomeService } from '../../../src/services/networking-security/LinkedHomeService';
import type { BrowserComputerService } from '../../../src/services/networking-security/BrowserComputerService';
import type { BrowserApi } from '../../../src/utils/browserApi';

const ready = {
	overview: { status: 'ready', projects: [], machines: [], liveSessions: 0 },
	agents: [],
	plans: [],
	scheduled: [],
	providers: { routines: null, quota: null }
};

function api(computers: { hostId: string; name: string; online: boolean }[] | 'disabled') {
	return {
		get: vi.fn(async () => {
			if (computers === 'disabled')
				throw Object.assign(new Error('off'), { code: 'remote-disabled' });
			return { computers };
		})
	} as unknown as BrowserApi;
}

function link(answer: () => Promise<unknown>) {
	return { home: vi.fn(answer), close: vi.fn() } as unknown as BrowserComputerService;
}

test('every online linked computer is read without a click, and offline ones are only counted', async () => {
	const one = link(async () => ready);
	const links = new Map([['a'.repeat(64), one]]);
	const service = new LinkedHomeService(
		api([
			{ hostId: 'a'.repeat(64), name: 'Primary', online: true },
			{ hostId: 'b'.repeat(64), name: 'MB2', online: false }
		]),
		'actor',
		(hostId) => links.get(hostId) as BrowserComputerService
	);
	const result = await service.read();
	expect(result).toMatchObject({ linked: 2, answered: 1 });
	expect(result.snapshot?.overview).toMatchObject({ liveSessions: 0 });
});

test('the connection of a computer is kept for the next read and closed with the page', async () => {
	const one = link(async () => ready);
	const create = vi.fn(() => one);
	const service = new LinkedHomeService(
		api([{ hostId: 'a'.repeat(64), name: 'Primary', online: true }]),
		'actor',
		create
	);
	await service.read();
	await service.read();
	expect(create).toHaveBeenCalledTimes(1);
	expect(one.home).toHaveBeenCalledTimes(2);
	service.close();
	expect(one.close).toHaveBeenCalled();
	expect(await service.read()).toMatchObject({ answered: 0, snapshot: null });
});

test('a computer that fails or sends a malformed view is dropped and tried again next time', async () => {
	const bad = link(async () => ({ agents: 'nope' }));
	const good = link(async () => ready);
	const create = vi.fn().mockReturnValueOnce(bad).mockReturnValueOnce(good);
	const service = new LinkedHomeService(
		api([{ hostId: 'a'.repeat(64), name: 'Primary', online: true }]),
		'actor',
		create
	);
	expect(await service.read()).toMatchObject({ linked: 1, answered: 0, snapshot: null });
	expect(bad.close).toHaveBeenCalled();
	expect(await service.read()).toMatchObject({ linked: 1, answered: 1 });
});

test('an account with no linked computer, or with remote access off, reads as none linked', async () => {
	for (const computers of [[], 'disabled' as const]) {
		const service = new LinkedHomeService(api(computers), 'actor', () => {
			throw new Error('unused');
		});
		expect(await service.read()).toEqual({ linked: 0, answered: 0, snapshot: null });
	}
});
