import { unitIdPattern } from '../../../../src/lib/contracts';
import { z } from 'zod';
export const id = z.uuid();
export const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const label = z.string().trim().min(1).max(200);
export const email = z
	.email()
	.max(320)
	.transform((value) => value.toLowerCase());
export const actorSchema = z.strictObject({
	id: label,
	email,
	name: label,
	emailVerified: z.literal(true)
});
export const repositorySchema = z.strictObject({
	id: z.number().int().positive(),
	owner: z.string().regex(/^[a-zA-Z0-9-]+$/),
	name: z.string().regex(/^[a-zA-Z0-9_.-]+$/),
	private: z.boolean(),
	installationId: z.number().int().positive()
});
export const branch = z
	.string()
	.min(1)
	.max(255)
	.refine((value) => !/(^\/|\/$|\.\.|@\{|[\s~^:?*[\\]|\.lock(?:\/|$)|\/\/|(?:^|\/)\.)/.test(value));
export const entityId = z.string().regex(unitIdPattern).max(240);
const region = z
	.strictObject({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		width: z.number().positive().max(1),
		height: z.number().positive().max(1)
	})
	.refine((r) => r.x + r.width <= 1 && r.y + r.height <= 1);
export const anchorSchema = z
	.strictObject({
		branch,
		commit: sha,
		entityId,
		version: z
			.string()
			.regex(/^v\d{3,}$/)
			.nullable(),
		imageSha256: hash.nullable(),
		state: label.nullable(),
		viewport: z.enum(['desktop', 'tablet', 'mobile', 'diagram']).nullable(),
		region: region.nullable()
	})
	.refine((a) =>
		a.imageSha256
			? Boolean(a.version && a.state && a.viewport)
			: a.state === null && a.viewport === null && a.region === null
	);
export function fail(code: string): never {
	throw Object.assign(new Error(`Collaboration ${code}`), { code });
}
export function parseCollaborationInput<T>(schema: z.ZodType<T>, value: unknown): T {
	const result = schema.safeParse(value);
	if (!result.success) return fail('invalid-input');
	return result.data;
}
export async function digest(bytes: Uint8Array, algorithm = 'SHA-256'): Promise<string> {
	const result = await crypto.subtle.digest(algorithm, new Uint8Array(bytes));
	return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, '0')).join('');
}
export function safePath(value: string): string {
	if (
		!value ||
		value.startsWith('/') ||
		value.includes('\\') ||
		value.split('/').some((p) => !p || p === '.' || p === '..') ||
		[...value].some((char) => char.charCodeAt(0) < 32)
	)
		return fail('invalid-path');
	return value;
}

export { parseCollaborationInput as parse };
