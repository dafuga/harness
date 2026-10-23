import type { CacheOptions, CacheHost, Kept } from './ui-remote-cache-fixture.types';
import type { Page } from '@playwright/test';
import { remotePhoneFixture } from './ui-remote-phone-fixture';
export * from './ui-remote-phone-fixture';

/**
 * SYNTHETIC NATIVE CACHE. It stands where the Swift plugin keeps answered reads: an answer the
 * synthetic computer gave while it was online is given again while it is away, with the time it
 * was saved. It lives in the test process, so it outlasts a reload as a file would. It proves
 * what the page does with a saved answer, and nothing about the files of the real plugin.
 */
export const savedAt = '2026-10-12T07:30:00.000Z';
const kept = ['listProjects', 'snapshot', 'entity', 'messages', 'image', 'source', 'history'];

/** SYNTHETIC: wraps the imitated native bridge; a mutation is never kept and never replayed. */
function installPhoneCache(options: CacheOptions) {
	const host = window as unknown as CacheHost;
	const native = host.Capacitor.nativePromise;
	host.Capacitor.nativePromise = async (plugin, method, call) => {
		if (method !== 'request' || !options.kept.includes(call.method))
			return native(plugin, method, call);
		const key = JSON.stringify([call.method, call.input]);
		if (host.__remotePhone.phone.state === 'online') {
			const answer = await native(plugin, method, call);
			await host.__phoneCache('save', key, answer.value);
			return answer;
		}
		const saved = await host.__phoneCache('read', key);
		if (!saved.hit) return native(plugin, method, call);
		return { value: saved.value, cachedAt: options.savedAt };
	};
}

/** From the next load on, the synthetic computer is away from the start. */
function startOffline() {
	(window as unknown as CacheHost).__remotePhone.phone.state = 'offline';
}

/** A paired phone whose synthetic plugin keeps the reads it was answered. */
export async function remoteCacheFixture(page: Page, state = 'online') {
	const outbox = await remotePhoneFixture(page, state);
	const cache = new Map<string, unknown>();
	await page.exposeFunction('__phoneCache', (op: string, key: string, value?: unknown): Kept => {
		if (op === 'save') cache.set(key, value);
		return { hit: cache.has(key), value: cache.get(key) };
	});
	const options: CacheOptions = { savedAt, kept };
	await page.addInitScript(installPhoneCache, options);
	return outbox;
}

/** The app is opened again while the computer cannot be reached. */
export async function reopenAway(page: Page) {
	await page.addInitScript(startOffline);
	await page.reload();
}
