import { componentManifestSchema } from '../../../../../../src/lib/contracts';
import { z } from 'zod';
import type {
	Anchor,
	RepositoryIdentity,
	SourceAdapter
} from '../../../models/planning-collaboration/Collaboration.types';
import type { GitHubTransport } from '../githubTransport';
import {
	anchorSchema,
	digest,
	fail,
	hash,
	parse,
	safePath
} from '../../planning-collaboration/parseCollaborationInput';
import { ensureAncestry } from '../githubHistory';

const categorySchema = z.enum(['page', 'shell', 'component', 'function', 'config', 'service']);

const image = z.object({ file: z.string(), sha256: hash, state: z.string(), viewport: z.string() });

async function json(
	adapter: SourceAdapter,
	repository: RepositoryIdentity,
	input: { commit: string; path: string }
): Promise<unknown> {
	try {
		return JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(await adapter.read(repository, input))
		);
	} catch {
		return fail('invalid-source');
	}
}

async function entityPlan(adapter: SourceAdapter, repository: RepositoryIdentity, anchor: Anchor) {
	const entries = await adapter.tree(repository, anchor.commit);
	const canonicalPath = `specification/units/${anchor.entityId}.json`;
	let category: string | undefined;
	if (entries.some((e) => e.path === canonicalPath)) {
		const manifest = parse(
			componentManifestSchema,
			await json(adapter, repository, { commit: anchor.commit, path: canonicalPath })
		);
		if (manifest.id !== anchor.entityId) return fail('invalid-entity');
		category = manifest.kind;
	}
	const plans = entries.filter((e) =>
		/^src\/(?:pages|shells|components|functions|configs|services)\/[^/]+\/plan\.json$/.test(e.path)
	);
	const matched: string[] = [];
	for (const entry of plans) {
		const plan = parse(
			z.object({
				unitId: z.string(),
				category: categorySchema,
				slug: z.string(),
				path: z.string()
			}),
			await json(adapter, repository, { commit: anchor.commit, path: entry.path })
		);
		if (plan.unitId !== anchor.entityId) continue;
		if (
			entry.path !== `${plan.path}/plan.json` ||
			plan.path !== `src/${plan.category}s/${plan.slug}`
		)
			return fail('invalid-entity');
		if (!attested(plan, category)) return fail('invalid-entity');
		matched.push(plan.path);
	}
	if (!validPlanCount(matched, category)) return fail('invalid-entity');
	return matched[0];
}

async function validateVersion(
	adapter: SourceAdapter,
	repository: RepositoryIdentity,
	input: { anchor: Anchor; path: string }
) {
	const { anchor, path } = input;
	const version = parse(
		z.object({ unitId: z.string(), version: z.string(), images: z.array(image) }),
		await json(adapter, repository, {
			commit: anchor.commit,
			path: `${path}/designs/${anchor.version}/design.json`
		})
	);
	if (version.unitId !== anchor.entityId || version.version !== anchor.version)
		return fail('invalid-version');
	if (!anchor.imageSha256) return;
	const selected = version.images.find(
		(i) =>
			i.sha256 === anchor.imageSha256 && i.state === anchor.state && i.viewport === anchor.viewport
	);
	if (!selected || safePath(selected.file).includes('/')) return fail('invalid-image');
	const bytes = await adapter.read(repository, {
		commit: anchor.commit,
		path: `${path}/designs/${anchor.version}/${selected.file}`
	});
	if ((await digest(bytes)) !== anchor.imageSha256) return fail('image-integrity');
}

export async function validateGitHubAnchor(
	deps: { adapter: SourceAdapter; client: GitHubTransport },
	repository: RepositoryIdentity,
	input: Anchor
): Promise<void> {
	const anchor = parse(anchorSchema, input);
	const tip = await deps.adapter.resolve(repository, `refs/heads/${anchor.branch}`);
	await deps.adapter.resolve(repository, anchor.commit);
	await ensureAncestry(deps.client, anchor.commit, tip.commit);
	if (anchor.entityId === 'harness.project.discussion') {
		if (anchor.version || anchor.imageSha256 || anchor.state || anchor.viewport || anchor.region)
			return fail('invalid-entity');
		return;
	}
	const path = await entityPlan(deps.adapter, repository, anchor);
	if (!anchor.version) return;
	if (!path) return fail('invalid-version');
	await validateVersion(deps.adapter, repository, { anchor, path });
}

function attested(
	plan: { category: string; unitId: string; slug: string },
	category?: string
): boolean {
	return category ? plan.category === category : plan.unitId === `${plan.category}.${plan.slug}`;
}

function validPlanCount(paths: string[], category?: string): boolean {
	return paths.length <= 1 && Boolean(category || paths.length);
}
