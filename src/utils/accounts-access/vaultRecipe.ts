// @harness-uid u_xg3ex7hmhj
import { createHash, createPublicKey, verify } from 'node:crypto';
import { z } from 'zod';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { canonical, hash } from '../../core/execution-runtimes/scripted-deploy/contracts';
import { vaultPasswordAction } from '../../validators/accounts-access/VaultWireValidator';
import { vaultMethod } from './vaultMethod';
import type {
	RecipeReviewer,
	VaultRecipe,
	VaultRecipeInput,
	VaultRecipeReview,
	VaultScriptApproval,
	VerifiedRecipe
} from './vaultRecipe.types';

export const recipeReviewMaxAgeMs = 90 * 24 * 3_600_000;

const identifier = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/u);
const pathPattern = z
	.string()
	.max(200)
	.regex(/^\/[A-Za-z0-9._~\-/*]*$/u);
const origin = z
	.string()
	.max(200)
	.refine(isExactHttpsOrigin, 'Expected an exact https origin without a path or port.');
const actionIds = z.array(identifier).min(1);
const scriptSha256 = z
	.string()
	.regex(/^[0-9a-f]{64}$/u)
	.optional();

const method = z.discriminatedUnion('kind', [
	z.strictObject({
		kind: z.literal('api-token'),
		actions: actionIds,
		credential: identifier,
		scriptSha256
	}),
	z.strictObject({
		kind: z.literal('oauth-device'),
		actions: actionIds,
		client: identifier,
		scopes: z.array(z.string().min(1).max(200)).min(1),
		scriptSha256
	}),
	z.strictObject({
		kind: z.literal('browser'),
		actions: actionIds,
		reason: z.string().min(10).max(300),
		scriptSha256
	})
]);
const action = z.strictObject({
	id: identifier,
	mode: z.enum(['read', 'write']),
	start: pathPattern
});
const recipeBase = z.strictObject({
	schemaVersion: z.literal(1),
	site: identifier,
	revision: z.number().int().positive(),
	account: z.strictObject({ alias: identifier, identity: z.string().min(1).max(200) }),
	origins: z.array(origin).min(1).max(8),
	redirects: z.array(origin).max(8).default([]),
	methods: z.array(method).min(1),
	actions: z.array(action).min(1),
	otp: z.array(z.enum(['totp', 'sms', 'email', 'push', 'passkey'])).default([]),
	login: z.array(z.strictObject({ id: identifier, url: pathPattern })).default([]),
	teardown: z.strictObject({
		logout: pathPattern.nullable(),
		revoke: identifier.nullable(),
		securityLog: identifier.nullable()
	}),
	timeouts: z.strictObject({
		loginMs: z.number().int().min(10_000).max(180_000),
		leaseMs: z.number().int().min(60_000).max(3_600_000)
	})
});

export const recipeSchema = recipeBase.superRefine(checkRecipe);

export const recipeReview = z.strictObject({
	site: identifier,
	revision: z.number().int().positive(),
	digest: z.string().regex(/^[0-9a-f]{64}$/u),
	reviewer: identifier,
	reviewedAt: z.number().int().nonnegative(),
	signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/u)
});

/** Parses an untrusted recipe and review envelope (both validated at runtime), and accepts it only with a current trusted signature over its digest. */
export function vaultRecipe(
	input: VaultRecipeInput,
	signed: VaultRecipeReview,
	reviewers: RecipeReviewer[],
	now: number = Date.now()
): VerifiedRecipe {
	const recipe = parse(recipeSchema, input, 'recipe');
	const review = parse(recipeReview, signed, 'recipe review');
	const digest = recipeDigest(recipe);
	if (
		review.site !== recipe.site ||
		review.revision !== recipe.revision ||
		review.digest !== digest
	) {
		throw new ExpectedCliError('The recipe review is for a different site, revision or digest.');
	}
	if (review.reviewedAt > now || now - review.reviewedAt > recipeReviewMaxAgeMs) {
		throw new ExpectedCliError('The recipe review is expired or dated in the future.');
	}
	const reviewer = reviewers.find(({ id }) => id === review.reviewer);
	if (!reviewer || !signatureValid(reviewer, review)) {
		throw new ExpectedCliError('The recipe review signature is not from a trusted reviewer.');
	}
	return { recipe, digest, display: digestDisplay(digest), review };
}

/** SHA-256 of the canonical JSON of a normalized recipe. */
export function recipeDigest(recipe: VaultRecipe): string {
	return hash(recipe);
}

/** Verifies script bytes against both the signed recipe and the phone-approved method. */
export function verifyVaultRecipeScript(
	verified: VerifiedRecipe,
	approval: VaultScriptApproval,
	script: Uint8Array
): void {
	if (
		approval.recipeDigest !== verified.digest ||
		recipeDigest(verified.recipe) !== verified.digest
	) {
		throw new ExpectedCliError('The approved recipe digest changed before script execution.');
	}
	const choice = vaultMethod(verified.recipe, approval.action, {
		'api-token': true,
		'oauth-device': true,
		browser: true
	});
	if (choice.status !== 'selected' || choice.method.kind !== approval.method) {
		throw new ExpectedCliError('The approved method is not the recipe method for this action.');
	}
	const actual = createHash('sha256').update(script).digest('hex');
	if (choice.method.scriptSha256 !== actual) {
		throw new ExpectedCliError('Script bytes do not match the reviewed script digest.');
	}
}

/** The digest prefix Harness iOS shows before approval: 16 hex digits in groups of four. */
export function digestDisplay(digest: string): string {
	return (digest.slice(0, 16).match(/.{4}/gu) ?? []).join(' ');
}

/** The exact bytes a reviewer signs for a recipe review. */
export function reviewSigningInput(
	review: Omit<VaultRecipeReview, 'signature' | 'reviewer'>
): Buffer {
	return Buffer.from(
		canonical({
			kind: 'vault-recipe-review',
			site: review.site,
			revision: review.revision,
			digest: review.digest,
			reviewedAt: review.reviewedAt
		})
	);
}

function signatureValid(reviewer: RecipeReviewer, review: VaultRecipeReview): boolean {
	const key = createPublicKey(reviewer.publicKey);
	return (
		key.asymmetricKeyType === 'ed25519' &&
		verify(null, reviewSigningInput(review), key, Buffer.from(review.signature, 'base64url'))
	);
}

function parse<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
	const result = schema.safeParse(input);
	if (!result.success) {
		const issue = result.error.issues[0];
		const where = issue?.path.join('.') || label;
		throw new ExpectedCliError('Invalid ' + label + ' at ' + where + ': ' + issue?.message);
	}
	return result.data;
}

function isExactHttpsOrigin(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.port === '' && url.origin === value;
	} catch {
		return false;
	}
}

function checkRecipe(recipe: z.output<typeof recipeBase>, context: z.RefinementCtx): void {
	const declared = new Set(recipe.actions.map(({ id }) => id));
	for (const entry of recipe.methods) {
		for (const id of entry.actions.filter((name) => !declared.has(name))) {
			context.addIssue({ code: 'custom', path: ['methods'], message: 'Unknown action ' + id });
		}
	}
	const browser = recipe.methods.filter(({ kind }) => kind === 'browser');
	const needsLogin = browser.some(({ actions }) =>
		actions.some((id) => id !== vaultPasswordAction)
	);
	if (
		(needsLogin && recipe.login.length === 0) ||
		(browser.length && recipe.teardown.logout === null)
	) {
		context.addIssue({
			code: 'custom',
			path: ['login'],
			message: 'A browser method needs login states and a provider logout path.'
		});
	}
}
