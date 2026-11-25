// @harness-uid u_ydbpwntlfp
import { accessSync, constants, readFileSync } from 'node:fs';
import { isIPv4 } from 'node:net';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { VaultBrowserDockerAdapter } from '../../adapters/accounts-access/VaultBrowserDockerAdapter';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { VaultPasswordPreparation } from '../../services/accounts-access/VaultBrokerService.types';
import { VaultPasswordService } from '../../services/accounts-access/VaultPasswordService';
import { reviewedSignup } from '../../services/accounts-access/vault-password-service/browserSignup';
import { openPrivateSignupBrowser } from '../../services/accounts-access/vault-password-service/privateSignupBrowser';
import { storeKeychainPassword } from '../../services/accounts-access/vault-password-service/storeKeychainPassword';
import { verifyCredentialRecipe } from './runCredentialRequest';

const file = z.string().refine(isAbsolute);
const id = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/u);
const scope = z.strictObject({ project: id, environment: id, host: id });
const entry = z.strictObject({
	scope,
	recipe: file,
	review: file,
	script: file
});
const settings = z.strictObject({
	reviewers: file,
	keychain: file,
	keychainHelper: file,
	image: z.string(),
	seccomp: file,
	dockerContext: z.string().min(1),
	network: z.strictObject({
		id: z.string(),
		hosts: z.record(z.string(), z.string().refine(isIPv4))
	}),
	entries: z.array(entry).min(1)
});

/** The operator configures trusted reviews, a private browser and the Keychain sink at startup. */
export function prepareCredentialPasswords(path: string, state: string): VaultPasswordPreparation {
	if (
		process.platform !== 'darwin' ||
		process.env.DEBUG ||
		process.env.PWDEBUG ||
		process.env.DEBUG_FILE ||
		process.execArgv.some((arg) => arg.startsWith('--inspect'))
	)
		throw new ExpectedCliError(
			'Password generation needs a macOS executor with browser debugging disabled.'
		);
	const config = settings.safeParse(JSON.parse(readFileSync(path, 'utf8')));
	if (!config.success) throw new ExpectedCliError('Invalid password executor configuration.');
	const { keychain, keychainHelper, seccomp, image, dockerContext, entries } = config.data;
	accessSync(keychain, constants.R_OK | constants.W_OK);
	accessSync(keychainHelper, constants.X_OK);
	const docker = new VaultBrowserDockerAdapter({
		image,
		seccomp,
		context: dockerContext,
		journal: join(state, 'password-browsers')
	});
	const services = entries.map((entry) => loadSignupService(entry, config.data, docker));
	return (request) => {
		const matches = services.map((service) => service.prepare(request)).filter(Boolean);
		return matches.length === 1 ? matches[0] : undefined;
	};
}

function loadSignupService(
	{ scope, recipe: path, review, script: source }: z.output<typeof entry>,
	{ keychain, keychainHelper, network, reviewers }: z.output<typeof settings>,
	docker: VaultBrowserDockerAdapter
): VaultPasswordService {
	const recipe = verifyCredentialRecipe({ recipe: path, review, reviewers });
	const script = readFileSync(source);
	const signup = reviewedSignup(recipe.recipe, script);
	if (!new URL(signup.origin).hostname.endsWith('.test'))
		throw new ExpectedCliError(
			'The installed browser executor only supports synthetic .test signups.'
		);
	const location = {
		keychain,
		service: [
			'org.harness.vault.password',
			scope.project,
			scope.environment,
			recipe.recipe.site,
			recipe.recipe.account.alias
		].join('/'),
		account: signup.identity
	};
	return new VaultPasswordService({
		scope,
		recipe,
		script,
		openBrowser: () =>
			openPrivateSignupBrowser(
				docker,
				network,
				signup,
				Math.min(recipe.recipe.timeouts.loginMs, 10_000)
			),
		store: (password) => storeKeychainPassword(keychainHelper, location, password)
	});
}
