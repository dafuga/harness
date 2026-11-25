import { expect, test, vi } from 'vitest';
import { BrowserComputerService } from '../../../src/services/networking-security/BrowserComputerService';
import type { BrowserApi } from '../../../src/utils/browserApi';

test('computer connection stops before opening the socket for a different or discarded host', async () => {
	const hostId = 'a'.repeat(40);
	const get = vi.fn(async () => ({ hostId: 'b'.repeat(40) }));
	const send = vi.fn();
	const api = { get, send } as unknown as BrowserApi;
	const rejected = new BrowserComputerService(api);
	await expect(rejected.connect(hostId, vi.fn())).rejects.toThrow('different computer');
	expect(send).not.toHaveBeenCalled();
	const closed = new BrowserComputerService(api);
	closed.close();
	await expect(closed.connect(hostId, vi.fn())).rejects.toThrow();
	expect(send).not.toHaveBeenCalled();
});
