import { z } from 'zod';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import { platformIds, type PlatformCatalog } from '../../../core/explorer-ui/Platform.types';

const text = z.string().trim().min(1).max(2000);
const path = text.refine(
	(value) =>
		!value.startsWith('/') &&
		!value.includes('\\') &&
		!value.includes(':') &&
		value.split('/').every((part) => part !== '..' && part !== '.' && part !== ''),
	'Repository-relative source path required'
);
const entry = z
	.object({
		id: z.enum(platformIds),
		runtime: text,
		status: z.enum(['configured', 'setup-required', 'not-configured']),
		summary: text,
		configuration: z
			.array(z.object({ name: text, value: text, description: text.optional() }).strict())
			.max(30),
		commands: z.array(z.object({ name: text, command: text }).strict()).max(12),
		requirements: z.array(text).max(20),
		sources: z.array(path).max(20)
	})
	.strict()
	.refine(
		(value) => value.status !== 'not-configured' || value.commands.length === 0,
		'Unconfigured platforms cannot declare executable commands'
	);
const manifest = z
	.object({
		schemaVersion: z.literal(1),
		platforms: z
			.array(entry)
			.max(4)
			.refine(
				(values) => new Set(values.map((value) => value.id)).size === values.length,
				'Each platform must be declared only once'
			)
	})
	.strict();

/** Reads configuration from this exact source tree, including an explicit gap on old revisions. */
export async function readPlatformCatalog(tree: SourceTree): Promise<PlatformCatalog> {
	const file = 'harness.platforms.json';
	if (!(await tree.list()).some((item) => item.path === file))
		return { entries: [], gap: 'No platform configuration is recorded at this revision.' };
	try {
		const source = await tree.read(file);
		if (source.length > 131072) throw new Error('Manifest exceeds 128 KiB.');
		const parsed = manifest.safeParse(JSON.parse(source));
		if (!parsed.success) throw new Error('Manifest does not match the platform schema.');
		return { entries: parsed.data.platforms };
	} catch {
		return {
			entries: [],
			gap: 'Platform configuration could not be read at this revision. Check harness.platforms.json.'
		};
	}
}
