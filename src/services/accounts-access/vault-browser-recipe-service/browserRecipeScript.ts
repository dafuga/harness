// @harness-uid u_xhiaeoubra
import { z } from 'zod';
import { ExpectedCliError } from '../../../core/development-tooling/errors';

const route = z
	.string()
	.max(200)
	.regex(/^\/(?!\/)[A-Za-z0-9/_-]*$/u);
const selector = z
	.string()
	.max(100)
	.regex(/^#[A-Za-z][A-Za-z0-9_-]*$/u);
const step = z.strictObject({
	path: route,
	next: route,
	field: z.enum(['password', 'otp']),
	input: selector,
	submit: selector
});
export const vaultBrowserScript = z.strictObject({
	steps: z.array(step).min(1).max(2),
	identity: selector,
	capability: selector,
	otpPrompt: selector.optional(),
	capture: z
		.strictObject({
			trigger: selector,
			result: route,
			value: selector
		})
		.optional()
});
export const vaultBrowserSecret = z.strictObject({
	password: z.string().min(1).max(1024)
});
export const vaultBrowserOtp = z.strictObject({ otp: z.string().regex(/^[0-9]{4,10}$/u) });

export function readVaultScript<T>(
	schema: z.ZodType<T>,
	bytes: Uint8Array,
	description: string
): T {
	try {
		return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		throw new ExpectedCliError('Invalid ' + description + '.');
	}
}
