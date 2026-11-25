// @harness-uid u_mucsxl7k4y
import type { Page } from 'playwright-core';
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { vaultPasswordAction } from '../../../validators/accounts-access/VaultWireValidator';
import type { VaultRecipe } from '../../../utils/accounts-access/vaultRecipe.types';
import { readVaultScript } from '../vault-browser-recipe-service/browserRecipeScript';
import type { VaultSignup } from './browserSignup.types';

const path = z
	.string()
	.max(200)
	.regex(/^\/(?!\/)[A-Za-z0-9/_-]*$/u);
const selector = z
	.string()
	.max(100)
	.regex(/^#[A-Za-z][A-Za-z0-9_-]*$/u);
export const vaultSignupScript = z.strictObject({
	identity: selector,
	password: selector,
	confirmation: selector.optional(),
	submit: selector,
	post: path,
	result: path,
	verifiedIdentity: selector
});

export function reviewedSignup(recipe: VaultRecipe, script: Uint8Array): VaultSignup {
	const form = readVaultScript(vaultSignupScript, script, 'reviewed signup script');
	const [origin] = recipe.origins;
	const action = recipe.actions.find(({ id }) => id === vaultPasswordAction);
	const logout = recipe.teardown.logout;
	if (
		action?.mode !== 'write' ||
		!path.safeParse(action.start).success ||
		!logout ||
		!path.safeParse(logout).success ||
		recipe.origins.length !== 1 ||
		[recipe.redirects, recipe.otp, recipe.login].some(({ length }) => length > 0)
	)
		throw new ExpectedCliError(
			'Signup requires one exact origin and a reviewed signup and logout route.'
		);
	const fields = [form.identity, form.password, form.confirmation, form.submit].filter(Boolean);
	if (new Set(fields).size !== fields.length || form.result === action.start)
		throw new ExpectedCliError('The signup fields and result page must be distinct.');
	return { origin, start: action.start, logout, identity: recipe.account.identity, form };
}

export async function prepareSignupForm(page: Page, signup: VaultSignup) {
	const { origin, start, logout, identity, form } = signup;
	const url = origin + start;
	const result = origin + form.result;
	await page.goto(url);
	await requireSignupForm(page, signup);
	await page.locator(form.identity).fill(identity);
	await requireSignupForm(page, signup);
	return async (password: Buffer): Promise<void> => {
		await requireSignupForm(page, signup);
		await page.locator(form.password).fill(password.toString('ascii'));
		if (form.confirmation) await page.locator(form.confirmation).fill(password.toString('ascii'));
		await requireSignupForm(page, signup);
		await Promise.all([page.waitForURL(result), page.locator(form.submit).click()]);
		if (
			page.url() !== result ||
			(await page.locator(form.verifiedIdentity).textContent()) !== identity
		)
			throw new ExpectedCliError('The signup result does not match the reviewed account.');
		const response = await page.goto(origin + logout);
		if (!response?.ok() || new URL(page.url()).origin !== origin)
			throw new ExpectedCliError('The signup session did not reach the reviewed logout.');
	};
}

async function requireSignupForm(page: Page, { origin, start, form }: VaultSignup) {
	const valid = await page.locator(form.submit).evaluate(
		(submit, { url, post, fields }) => {
			if (
				submit.ownerDocument.URL !== url ||
				!(submit instanceof HTMLButtonElement) ||
				submit.type !== 'submit'
			)
				return false;
			const signup = submit.form;
			if (
				signup?.method !== 'post' ||
				signup.action !== post ||
				signup.target ||
				['formaction', 'formmethod', 'formtarget'].some((name) => submit.hasAttribute(name))
			)
				return false;
			return fields.every(({ selector, types }) => {
				const matches = submit.ownerDocument.querySelectorAll(selector);
				const field = matches[0];
				return (
					matches.length === 1 &&
					field instanceof HTMLInputElement &&
					field.form === signup &&
					Boolean(field.name) &&
					types.includes(field.type)
				);
			});
		},
		{
			url: origin + start,
			post: origin + form.post,
			fields: [
				{ selector: form.identity, types: ['text', 'email'] },
				{ selector: form.password, types: ['password'] },
				...(form.confirmation ? [{ selector: form.confirmation, types: ['password'] }] : [])
			]
		}
	);
	if (!valid) throw new ExpectedCliError('The browser is outside the reviewed signup form.');
}
