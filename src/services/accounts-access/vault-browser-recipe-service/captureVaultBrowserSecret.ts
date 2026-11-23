// @harness-uid u_xhiaeoubra
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { VaultBrowserRecipePage } from '../VaultBrowserRecipeService.types';

export async function captureVaultBrowserSecret(
	page: VaultBrowserRecipePage,
	origin: string,
	{ trigger, result, value }: { trigger: string; result: string; value: string },
	store: (bytes: Uint8Array) => Promise<void>
): Promise<void> {
	await page.locator(trigger).click();
	const resultUrl = origin + result;
	await page.waitForURL(resultUrl);
	const credential = await page.locator(value).textContent();
	if (
		page.url() !== resultUrl ||
		!credential ||
		credential.length > 8192 ||
		/\s/u.test(credential)
	) {
		throw new ExpectedCliError('The provider result did not match the reviewed capture step.');
	}
	const bytes = Buffer.from(credential);
	try {
		await store(bytes);
	} finally {
		bytes.fill(0);
	}
}
