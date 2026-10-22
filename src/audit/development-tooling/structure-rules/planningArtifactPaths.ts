import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';
import { canonicalJson } from '../../../utils/development-tooling/canonicalJson';

const text = z
	.string()
	.min(1)
	.max(1_000_000)
	.refine((value) => Boolean(value.trim()));

const categories = {
	page: 'pages',
	shell: 'shells',
	component: 'components',
	function: 'functions',
	config: 'configs',
	service: 'services'
};

const contract = z.strictObject({
	responsibility: text,
	inputs: z.array(z.strictObject({ name: text, type: text })),
	outputs: z.array(z.strictObject({ name: text, type: text })),
	errors: z.array(text).refine((values) => new Set(values).size === values.length),
	states: z.array(text).refine((values) => new Set(values).size === values.length),
	viewports: z
		.array(z.enum(['desktop', 'tablet', 'mobile', 'diagram']))
		.refine((values) => new Set(values).size === values.length)
});

const planSchema = z.strictObject({
	unitId: z.string().regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/),
	category: z.enum(['page', 'shell', 'component', 'function', 'config', 'service']),
	slug: z
		.string()
		.max(64)
		.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
	path: text,
	title: text,
	goal: text,
	createdAt: z.iso.datetime(),
	createdBy: z.strictObject({ kind: z.enum(['person', 'agent']), name: text }),
	baseRevision: z.string().regex(/^[a-f0-9]{40}$/),
	contract,
	contractHash: z.string().regex(/^[a-f0-9]{64}$/)
});

const planFile = /^src\/(pages|shells|components|functions|configs|services)\/[^/]+\/plan\.json$/;

const artifact =
	/^(?:plan\.json|\.gitattributes|designs\/v\d{3,}\/(?:design\.json|prompt\.md|notes\.md|[a-z0-9][a-z0-9-]*\.png)|designs\/approvals\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.json|threads\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/(?:thread\.json|messages\.ndjson))$/;

/** Exact artifact paths and their ancestors; never a blanket exclusion of an entity folder. */
export function planningArtifactPaths(root: string | undefined, files: string[]): Set<string> {
	const accepted = new Set<string>();
	if (!root) return accepted;
	for (const file of files.filter((path) => planFile.test(path))) {
		const base = validatedPlan(root, file, files);
		if (!base) continue;
		for (const path of files.filter((path) => path.startsWith(`${base}/`))) {
			if (!artifact.test(path.slice(base.length + 1))) continue;
			accepted.add(path);
			const parts = path.split('/');
			for (let index = 1; index < parts.length; index++)
				accepted.add(`${parts.slice(0, index).join('/')}/`);
		}
	}
	return accepted;
}

function validatedPlan(root: string, file: string, files: string[]): string | null {
	try {
		const plan = planSchema.parse(JSON.parse(readFileSync(join(root, file), 'utf8')));
		const base = `src/${categories[plan.category]}/${plan.slug}`;
		if (plan.path !== base || file !== `${base}/plan.json`) return null;
		const hash = createHash('sha256').update(canonicalJson(plan.contract)).digest('hex');
		if (hash !== plan.contractHash) return null;
		if (plan.unitId !== `${plan.category}.${plan.slug}` && !canonical(root, plan, files))
			return null;
		return base;
	} catch {
		return null;
	}
}

function canonical(root: string, plan: z.infer<typeof planSchema>, files: string[]): boolean {
	const file = `specification/units/${plan.unitId}.json`;
	if (!files.includes(file)) return false;
	const unit = componentManifestSchema.parse(JSON.parse(readFileSync(join(root, file), 'utf8')));
	return unit.id === plan.unitId && unit.kind === plan.category;
}
