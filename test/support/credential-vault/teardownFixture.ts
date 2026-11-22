import { expect } from 'vitest';
import type { VaultBrowserDockerSession } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter.types';
import { VaultTeardownService } from '../../../src/services/accounts-access/VaultTeardownService';
import type { VaultLeaseEnded } from '../../../src/services/accounts-access/VaultLeaseKeeperService.types';
import type { VaultCleanupStep } from '../../../src/services/accounts-access/VaultTeardownService.types';
import { vaultTeardownLimits } from '../../../src/utils/accounts-access/vaultTeardown';
import { approved, assertFixtureRemoved } from './dockerBrowser';
import { withPrivateBrowser } from './privateBrowser';

export async function finishSyntheticFixture(
	ended: VaultLeaseEnded,
	guest: VaultBrowserDockerSession,
	closeRelay: () => Promise<void>,
	securityLog: () => Promise<string>
): Promise<void> {
	let shiftedClock: number | undefined;
	const service = new VaultTeardownService({
		now: () => shiftedClock ?? Date.now(),
		cleanup: (step) => cleanupFixture(step, guest, closeRelay),
		readSecurityLog: async () => {
			const security = JSON.parse(await securityLog());
			expect(security.active).toBe(0);
			expect(security.events.map(({ kind }: { kind: string }) => kind)).toEqual(['login', 'other']);
			return security.events;
		}
	});
	const first = await service.run(ended.teardown, ['synthetic-session']);
	expect(first.failed).toEqual([]);
	expect(first.audit).toEqual([{ verdict: 'clean', checked: 2 }]);
	expect(first.followUps).toHaveLength(1);
	const firstCheck = ended.teardown.find((step) => step.step === 'security-log');
	expect(first.followUps[0].at).toBe(firstCheck!.at + vaultTeardownLimits.recheckMs);
	shiftedClock = first.followUps[0].at;
	const second = await service.run(first.followUps, ['synthetic-session']);
	expect(second.audit).toEqual([{ verdict: 'clean', checked: 2 }]);
	expect(second.followUps).toEqual([]);
}

async function cleanupFixture(
	step: VaultCleanupStep,
	guest: VaultBrowserDockerSession,
	closeRelay: () => Promise<void>
): Promise<void> {
	switch (step.step) {
		case 'close-cdp-endpoint':
			await closeRelay();
			break;
		case 'provider-logout':
			await withPrivateBrowser(guest.pipe, async (browser) => {
				const page = await browser.contexts()[0].newPage();
				await page.goto(approved + step.path, { timeout: 8_000 });
				expect(await page.locator('h1').innerText()).toBe('Signed out');
			});
			break;
		case 'remove-container':
			await guest.close();
			break;
		case 'verify-removal':
			await assertFixtureRemoved(guest.owner);
			break;
		case 'revoke-sessions':
			throw new Error('The synthetic fixture declares no separate revoke action.');
	}
}
