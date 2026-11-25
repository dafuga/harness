// @harness-uid u_mucsxl7k4y
import { randomBytes } from 'node:crypto';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import {
	recipeReviewMaxAgeMs,
	verifyVaultRecipeScript
} from '../../utils/accounts-access/vaultRecipe';
import { vaultPasswordAction } from '../../validators/accounts-access/VaultWireValidator';
import type { VaultSessionRequest } from '../../validators/accounts-access/VaultWireValidator.types';
import type { VaultPasswordConfig } from './VaultPasswordService.types';

/** Generates a password inside the approved executor and returns only after browser teardown. */
export class VaultPasswordService {
	constructor(private readonly config: VaultPasswordConfig) {
		const { recipe, script } = config;
		verifyVaultRecipeScript(
			recipe,
			{ recipeDigest: recipe.digest, action: vaultPasswordAction, method: 'browser' },
			script
		);
	}

	prepare(request: VaultSessionRequest): (() => Promise<void>) | undefined {
		const { recipe: verified, scope } = this.config;
		const { recipe, digest } = verified;
		if (
			Date.now() - verified.review.reviewedAt > recipeReviewMaxAgeMs ||
			request.action !== vaultPasswordAction ||
			request.method !== 'browser' ||
			request.mode !== 'write' ||
			request.project !== scope.project ||
			request.environment !== scope.environment ||
			request.host !== scope.host ||
			request.site !== recipe.site ||
			request.account !== recipe.account.alias ||
			request.recipe.site !== recipe.site ||
			request.recipe.revision !== recipe.revision ||
			request.recipe.digest !== digest ||
			request.leaseMs !== recipe.timeouts.leaseMs ||
			request.origins.length !== 1 ||
			request.origins[0] !== recipe.origins[0]
		)
			return undefined;
		return () => this.run();
	}

	private async run(): Promise<void> {
		const browser = await this.config.openBrowser();
		let password: Buffer | undefined;
		try {
			const submit = await browser.prepareForm();
			password = generatePassword();
			await this.config.store(password);
			await submit(password);
		} catch {
			throw new ExpectedCliError(
				'Password generation stopped. Check the scoped Vault entry and account before retrying.'
			);
		} finally {
			password?.fill(0);
			await browser.close().catch(() => {
				throw new ExpectedCliError('Password browser teardown could not be verified.');
			});
		}
	}
}

function generatePassword(): Buffer {
	const entropy = randomBytes(24);
	try {
		return Buffer.from('Aa1!' + entropy.toString('base64url'), 'ascii');
	} finally {
		entropy.fill(0);
	}
}
