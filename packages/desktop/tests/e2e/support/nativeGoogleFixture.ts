import type { Start, Exchange, Status } from './nativeGoogleFixture.types';
import { createHash } from 'node:crypto';
import type { ElectronApplication, Page } from '../../../../../test/support/browserTest';
import { expect } from '../../../../../test/support/browserTest';
import { isAbsolute, resolve } from 'node:path';

const handoffId = 'h'.repeat(43);
const code = 'c'.repeat(43);

export function nativeGoogleFixture() {
	let pending: Start | undefined;
	return {
		start(body: string, origin: string) {
			pending = JSON.parse(body) as Start;
			if (!Number.isInteger(pending.callback))
				throw new Error('Expected a desktop loopback callback.');
			return {
				handoffId,
				userCode: '',
				verificationUrl: `${origin}/native/${handoffId}?return=1`,
				expiresAt: new Date(Date.now() + 300_000).toISOString(),
				interval: 1
			};
		},
		exchange(body: string) {
			const input = JSON.parse(body) as Exchange;
			const proof = pending;
			pending = undefined;
			if (!proof || input.handoffId !== handoffId || input.callbackCode !== code) return null;
			const challenge = createHash('sha256').update(input.verifier).digest('base64url');
			return challenge === proof.challenge &&
				input.nonce === proof.nonce &&
				input.resource === proof.resource
				? input
				: null;
		},
		async returnToApp() {
			if (!pending) throw new Error('The desktop did not start Google sign-in.');
			const origin = `http://127.0.0.1:${pending.callback}`;
			const response = await fetch(`${origin}/harness-account?state=${handoffId}&code=${code}`);
			expect(response.url).toBe(origin + '/return-to-harness');
			expect(response.ok).toBe(true);
		}
	};
}

export async function enableFixtureStorage(app: ElectronApplication, profile: string) {
	const actual = await app.evaluate(({ app, safeStorage }) => {
		Object.assign(safeStorage, {
			isEncryptionAvailable: () => true,
			getSelectedStorageBackend: () => 'gnome_libsecret',
			encryptString: (value: string) => Buffer.from(value),
			decryptString: (value: Buffer) => value.toString('utf8')
		});
		return app.getPath('userData');
	});
	expect(resolve(actual)).toBe(resolve(profile));
}

export async function completeNativeGoogle(
	app: ElectronApplication,
	page: Page,
	hub: ReturnType<typeof nativeGoogleFixture>
) {
	await app.evaluate(({ shell }) => {
		Object.assign(shell, {
			openExternal: async (url: string) => {
				if (!/^http:\/\/127\.0\.0\.1:\d+\/native\/[\w-]{43}\?return=1$/.test(url))
					throw new Error('Expected to open the synthetic Hub in the browser.');
			}
		});
	});
	const button = page.getByRole('button', { name: 'Sign in with Google' });
	await expect(button).toBeVisible();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all(
				[...document.querySelectorAll('main img')].map((image) =>
					(image as HTMLImageElement).decode()
				)
			);
		});
		await page.screenshot({
			path: `/tmp/harness-native-desktop-account-${process.env.SCREENSHOT_LABEL}.png`
		});
	}
	expect(
		await page.evaluate(async () => {
			const bridge = (window as unknown as { harness: { listProjects: () => Promise<unknown> } })
				.harness;
			return await bridge.listProjects().then(
				() => true,
				() => false
			);
		})
	).toBe(false);
	await button.click();
	await expect(page.getByRole('status')).toHaveText('Waiting for Google…');
	await hub.returnToApp();
	const account = page.getByRole('button', { name: 'Account', exact: true });
	await account.click();
	await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
	await account.click();
	const reported = await page.evaluate(async () => {
		const bridge = (window as unknown as { harness: { hostedStatus: () => Promise<Status> } })
			.harness;
		return await bridge.hostedStatus();
	});
	expect(reported).toMatchObject({ configured: true, state: 'signed-in' });
}

export function packagedFixture() {
	const packagedApp = process.env.HARNESS_PACKAGED_APP;
	if (packagedApp && (!isAbsolute(packagedApp) || !packagedApp.endsWith('.app')))
		throw new Error('HARNESS_PACKAGED_APP must be an absolute macOS .app bundle path.');
	return packagedApp;
}
