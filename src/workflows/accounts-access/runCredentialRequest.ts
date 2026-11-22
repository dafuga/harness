// @harness-uid u_ydbpwntlfp
import { readFileSync } from 'node:fs';
import { VaultBrokerClientAdapter } from '../../adapters/accounts-access/VaultBrokerClientAdapter';
import type { VaultCreated } from '../../services/accounts-access/VaultBrokerService.types';
import { vaultMethod, vaultMethodOrder } from '../../utils/accounts-access/vaultMethod';
import {
	digestDisplay,
	recipeDigest,
	recipeSchema,
	vaultRecipe
} from '../../utils/accounts-access/vaultRecipe';
import type { VerifiedRecipe } from '../../utils/accounts-access/vaultRecipe.types';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type { VaultSessionRequest } from '../../validators/accounts-access/VaultWireValidator.types';
import type {
	CredentialRecipeFiles,
	CredentialRequestOptions,
	CredentialRequestResult
} from './runCredentialRequest.types';

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

/** The digest Harness iOS shows for a recipe file, without checking its review. */
export function credentialRecipeDigest(path: string): { digest: string; display: string } {
	const digest = recipeDigest(recipeSchema.parse(readJson(path)));
	return { digest, display: digestDisplay(digest) };
}

/** Loads a recipe and accepts it only with a current review signed by a trusted reviewer. */
export function verifyCredentialRecipe(
	files: CredentialRecipeFiles,
	now = Date.now()
): VerifiedRecipe {
	const reviewers = readJson(files.reviewers) as { reviewers: { id: string; publicKey: string }[] };
	return vaultRecipe(
		readJson(files.recipe) as never,
		readJson(files.review) as never,
		reviewers.reviewers,
		now
	);
}

/**
 * Preflights and files one request: the reviewed recipe, the selection rule (API token, then
 * device grant, then browser; never falling through) and the account alias. A failed
 * preflight returns its reason and never reaches the phone.
 */
export async function runCredentialRequest(
	options: CredentialRequestOptions
): Promise<CredentialRequestResult> {
	const verified = verifyCredentialRecipe(options);
	const { recipe } = verified;
	if (options.account && options.account !== recipe.account.alias) {
		return { status: 'blocked', reason: 'The recipe is for account ' + recipe.account.alias + '.' };
	}
	const ready = new Set(options.ready);
	const readiness = Object.fromEntries(
		vaultMethodOrder.filter((kind) => ready.has(kind)).map((kind) => [kind, true as const])
	);
	const choice = vaultMethod(recipe, options.action, readiness);
	if (choice.status !== 'selected') return { status: choice.status, reason: choice.reason };
	const action = recipe.actions.find(({ id }) => id === options.action);
	if (!action) throw new VaultBrokerError(400, 'Unknown recipe action.');
	const input: VaultSessionRequest = {
		item: options.item,
		session: options.session,
		project: options.project,
		environment: options.environment,
		site: recipe.site,
		action: action.id,
		account: recipe.account.alias,
		mode: action.mode,
		method: choice.method.kind,
		recipe: { site: recipe.site, revision: recipe.revision, digest: verified.digest },
		host: options.host,
		runnerPublicKey: options.runnerKey,
		origins: recipe.origins,
		leaseMs: recipe.timeouts.leaseMs,
		reason: options.reason
	};
	const client = new VaultBrokerClientAdapter({ socketPath: options.socket });
	const created = await client.call<VaultCreated>('/v1/session/requests', input);
	return { status: 'requested', method: input.method, display: verified.display, ...created };
}
