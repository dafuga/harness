// @harness-uid u_xhiaeoubra
import { captureVaultBrowserSecret } from './vault-browser-recipe-service/captureVaultBrowserSecret';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { verifyVaultRecipeScript } from '../../utils/accounts-access/vaultRecipe';
import { vaultOtpRoute } from '../../utils/accounts-access/vaultOtpRoute';
import type { VaultOtpChannel } from '../../utils/accounts-access/vaultRecipe.types';
import type {
	VaultBrowserRecipeInput,
	VaultBrowserRecipeConfig,
	VaultBrowserRecipePage,
	VaultSecretSink
} from './VaultBrowserRecipeService.types';
import {
	readVaultScript,
	vaultBrowserOtp,
	vaultBrowserScript,
	vaultBrowserSecret
} from './vault-browser-recipe-service/browserRecipeScript';

/** Runs a reviewed synthetic browser script on the executor's private browser connection. */
export class VaultBrowserRecipeService {
	constructor(private readonly config: VaultBrowserRecipeConfig) {}

	async run(input: VaultBrowserRecipeInput): Promise<void> {
		const { recipe, approval, script } = input;
		verifyVaultRecipeScript(recipe, approval, script);
		const origin = recipe.recipe.origins[0];
		const action = recipe.recipe.actions.find(({ id }) => id === approval.action);
		if (approval.method !== 'browser' || !new URL(origin).hostname.endsWith('.test') || !action) {
			throw new ExpectedCliError('Only a reviewed synthetic browser action is executable here.');
		}
		const program = readVaultScript(vaultBrowserScript, script, 'synthetic browser script');
		const routes = recipe.recipe.login.map(({ url }) => url);
		const expectedRoutes = program.steps.map(({ path }) => path);
		if (
			routes.join('\n') !== expectedRoutes.join('\n') ||
			program.steps.at(-1)?.next !== action.start
		) {
			throw new ExpectedCliError('Signed script routes do not match the reviewed login scope.');
		}
		const sink = program.capture && this.secretWriter(approval, action.mode);
		await this.login(origin, program, recipe.recipe.otp);
		await this.verifyAction(
			{ url: origin + action.start, identity: recipe.recipe.account.identity, action: action.id },
			program,
			sink
		);
	}

	private secretWriter(
		approval: VaultBrowserRecipeInput['approval'],
		mode: string
	): VaultSecretSink {
		const writer = mode === 'write' ? this.config.secretDestination?.(approval) : undefined;
		if (!writer) throw new ExpectedCliError('The reviewed secret destination is unavailable.');
		return writer;
	}

	private async verifyAction(
		{ url, identity, action }: { url: string; identity: string; action: string },
		program: ReturnType<typeof vaultBrowserScript.parse>,
		secretSink?: VaultSecretSink
	): Promise<void> {
		const page = await this.config.newPage();
		try {
			await page.goto(url);
			if (
				page.url() !== url ||
				(await page.locator(program.identity).textContent()) !== identity ||
				(await page.locator(program.capability).textContent()) !== action
			)
				throw new ExpectedCliError('Identity or capability verification failed.');
			if (program.capture && secretSink)
				await captureVaultBrowserSecret(page, new URL(url).origin, program.capture, secretSink);
		} catch {
			if (program.capture)
				throw new ExpectedCliError('Secret capture stopped. Check provider state before retrying.');
			await page.close();
			throw new ExpectedCliError('Could not verify the synthetic browser account and capability.');
		} finally {
			if (program.capture) await closeCapturePage(page);
		}
	}

	private async login(
		origin: string,
		script: ReturnType<typeof vaultBrowserScript.parse>,
		channels: VaultOtpChannel[]
	): Promise<void> {
		const page = await this.config.newPage();
		let secret: Buffer | undefined;
		try {
			secret = this.config.openSecret();
			const { password } = readVaultScript(vaultBrowserSecret, secret, 'sealed browser credential');
			await page.goto(origin + script.steps[0].path);
			for (const step of script.steps) {
				if (page.url() !== origin + step.path)
					throw new ExpectedCliError('The login page changed.');
				const value =
					step.field === 'password' ? password : await this.otp(page, script.otpPrompt, channels);
				if (page.url() !== origin + step.path)
					throw new ExpectedCliError('The login page changed.');
				await page.locator(step.input).fill(value);
				await Promise.all([page.waitForURL(origin + step.next), page.locator(step.submit).click()]);
			}
		} catch {
			throw new ExpectedCliError('The synthetic login stopped before verification.');
		} finally {
			secret?.fill(0);
			await page.close();
		}
	}

	private async otp(
		page: VaultBrowserRecipePage,
		prompt: string | undefined,
		channels: VaultOtpChannel[]
	): Promise<string> {
		if (!prompt || !this.config.openOtp)
			throw new ExpectedCliError('The signed OTP step is unavailable.');
		const kind = await page.locator(prompt).textContent();
		if (kind !== 'sms' && kind !== 'email') throw new ExpectedCliError('Unexpected OTP channel.');
		const plan = vaultOtpRoute(channels, { kind, issuedAt: Date.now() });
		if (plan.route !== 'phone-entry')
			throw new ExpectedCliError('OTP channel is outside the recipe scope.');
		const bytes = await this.config.openOtp(plan);
		try {
			if (Date.now() >= plan.expiresAt) throw new ExpectedCliError('The OTP challenge expired.');
			return readVaultScript(vaultBrowserOtp, bytes, 'sealed OTP').otp;
		} finally {
			bytes.fill(0);
		}
	}
}

async function closeCapturePage(page: VaultBrowserRecipePage): Promise<void> {
	try {
		await page.close();
	} catch {
		throw new ExpectedCliError('Destroy the capture browser before any handoff.');
	}
}
