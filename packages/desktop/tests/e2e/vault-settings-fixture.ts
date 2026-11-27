import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import type { ScenarioManifest } from '../../../../src/core/unitTypes';
import scenario from '../../../../specification/scenarios/vault-local-setup.json' with { type: 'json' };
import { scenarioCapture } from './scenario-capture';

export async function mockVaultSetup(page: Page) {
	await page.addInitScript(() => {
		let status = 'absent';
		Object.assign(window, {
			vaultSetup: {
				status: async () => status,
				run: (action: 'setup' | 'remove') => {
					status = 'working:' + action + ':engine';
					return new Promise((resolve) => {
						Object.assign(window, {
							finishVault: (failure = false) => {
								status = failure
									? 'failed:' + action + ':engine'
									: action === 'setup'
										? 'ready'
										: 'absent';
								resolve(failure ? 'Vault setup failed at engine. Retry to resume.' : null);
							}
						});
					});
				}
			}
		});
	});
}

export async function exerciseVaultSetup(page: Page, viewport: string) {
	const setup = page.getByRole('button', { name: 'Set up vault on this computer' });
	await expect(setup).toBeVisible();
	await setup.click();
	await expect(
		page.getByRole('status').filter({ hasText: 'Starting the private Docker engine' })
	).toBeVisible();
	await expect(setup).toBeDisabled();
	await captureVaultSettings(page, viewport, 'progress');
	await finishVault(page, false);
	await expect(page.getByText('Vault is set up on this computer.')).toBeVisible();
	await captureVaultSettings(page, viewport, 'ready');
	await page.getByRole('button', { name: 'Repair vault' }).click();
	await finishVault(page, true);
	await expect(
		page.getByRole('alert').filter({ hasText: 'Vault setup failed at engine.' })
	).toBeVisible();
	await captureVaultSettings(page, viewport, 'failed');
	await page.getByRole('button', { name: 'Remove vault' }).click();
	await finishVault(page, false);
	await expect(setup).toBeEnabled();
}

export async function captureVaultSettings(page: Page, viewport: string, state = 'initial') {
	const directory = process.env.VAULT_SETTINGS_EVIDENCE_DIR;
	if (!directory && !process.env.HARNESS_EVIDENCE_DIR) return;
	if (state === 'initial') {
		await page
			.getByRole('button', { name: 'Set up vault on this computer' })
			.waitFor({ timeout: 1500 })
			.catch(() => {});
	}
	const card = page.getByRole('region', { name: 'Credential Vault' });
	if (await card.isVisible()) await card.scrollIntoViewIfNeeded();
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	await scenarioCapture(page, scenario as ScenarioManifest, {
		state,
		name: 'settings',
		note: 'Compiled Settings renderer over a synthetic local installer bridge.'
	});
	if (!directory) return;
	await page.mouse.move(0, 0);
	mkdirSync(directory, { recursive: true });
	await page.screenshot({
		path: directory + '/' + state + '-' + viewport + '.png',
		animations: 'disabled'
	});
}

async function finishVault(page: Page, failure: boolean) {
	await page.evaluate((shouldFail) => {
		(window as unknown as { finishVault(failure: boolean): void }).finishVault(shouldFail);
	}, failure);
}
