import { cloudflareSafety } from './cloudflareSafety';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { parse as jsonc, type ParseError } from 'jsonc-parser/lib/esm/main.js';
import { parse as toml } from 'smol-toml';
import { z } from 'zod';
import { deploymentEnvironments } from '../models/Deployment.types';
import type {
	CloudflareTarget,
	DeploymentConfig,
	DeploymentEnvironment
} from '../models/Deployment.types';
import { gitRead } from './gitRead';
const text = z.string().min(1);
const targetSchema = z.object({
	wranglerEnvironment: z.string().default(''),
	branch: z.string().default(''),
	tokenEnv: text.regex(/^HARNESS_[A-Z0-9_]+_CLOUDFLARE_API_TOKEN$/),
	healthUrl: z.url().refine((value) => value.startsWith('https://')),
	accountId: text.regex(/^[a-f0-9]{32}$/),
	name: text.regex(/^[a-z0-9][a-z0-9-]+$/)
});
const settingsSchema = z.object({
	adapter: z.literal('cloudflare'),
	sourceBranch: text,
	config: text.default('wrangler.jsonc'),
	environments: z.partialRecord(z.enum(deploymentEnvironments), targetSchema)
});
const aliases: Record<DeploymentEnvironment, string[]> = {
	dev: ['dev', 'development'],
	stage: ['stage', 'staging'],
	preprod: ['preprod', 'preproduction'],
	prod: ['prod', 'production']
};
export function deploymentPath(root: string, path: string): string {
	const full = resolve(root, path),
		rel = relative(root, full);
	if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('/'))
		throw new Error('Deployment paths must stay inside the project.');
	return full;
}
async function read(root: string, path: string): Promise<string | null> {
	try {
		const file = await realpath(deploymentPath(root, path));
		deploymentPath(await realpath(root), file);
		return await readFile(file, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}
function parse(raw: string, path: string): Record<string, unknown> {
	if (path.endsWith('.toml')) return toml(raw);
	const errors: ParseError[] = [];
	const value = jsonc(raw, errors, { allowTrailingComma: true });
	if (errors.length || !value || typeof value !== 'object')
		throw new Error('Invalid Wrangler configuration.');
	return value;
}
async function configFile(root: string, selected?: string) {
	for (const path of selected ? [selected] : ['wrangler.jsonc', 'wrangler.json', 'wrangler.toml']) {
		const raw = await read(root, path);
		if (raw !== null) return { path, config: parse(raw, path), raw };
	}
	throw new Error('No Cloudflare Wrangler configuration found.');
}
function detected(
	config: Record<string, unknown>,
	environment: DeploymentEnvironment
): Record<string, unknown> | null {
	const env = config.env as Record<string, Record<string, unknown>> | undefined;
	const names = aliases[environment].filter((name) => env?.[name]);
	if (names.length !== 1) return null;
	const name = names[0],
		value = env![name];
	if (typeof value.name !== 'string') return null;
	return { ...value, wranglerEnvironment: name };
}
/** Heuristics identify a plugin and named targets; unknown account/health mappings stay blocked. */
export async function deploymentConfig(root: string): Promise<DeploymentConfig> {
	const raw = await read(root, 'harness.deploy.json');
	const settings = raw === null ? null : settingsSchema.parse(JSON.parse(raw));
	const { path, config, raw: wranglerRaw } = await configFile(root, settings?.config);
	const sourceBranch =
		settings?.sourceBranch ?? (await gitRead(root, ['symbolic-ref', '--short', 'HEAD'])).trim();
	const targets: DeploymentConfig['targets'] = {};
	for (const environment of deploymentEnvironments) {
		const value = configuredTarget(config, {
			root,
			environment,
			path,
			mapping: settings?.environments[environment]
		});
		if (value) targets[environment] = value;
	}
	cloudflareSafety(config, targets);
	const workers = Object.values(targets)
		.filter((item) => item.kind === 'workers')
		.map((item) => `${item.accountId}/${item.name}`);
	if (new Set(workers).size !== workers.length)
		throw new Error('Environment Worker targets must be distinct.');
	return {
		sourceBranch,
		targets,
		fingerprint: createHash('sha256')
			.update((raw ?? '') + wranglerRaw)
			.digest('hex')
	};
}

function configuredTarget(
	config: Record<string, unknown>,
	input: {
		root: string;
		environment: DeploymentEnvironment;
		path: string;
		mapping?: z.infer<typeof targetSchema>;
	}
): CloudflareTarget | null {
	const { environment, path, mapping, root } = input;

	const named = detected(config, environment);
	if (!mapping && !named) return null;
	const candidate = mapping ?? inferredTarget(config, environment, named);
	const parsed = targetSchema.safeParse(candidate);
	if (!parsed.success) return null;
	const kind = typeof config.pages_build_output_dir === 'string' ? 'pages' : 'workers';
	if (kind === 'pages') deploymentPath(root, String(config.pages_build_output_dir));
	const value: CloudflareTarget = {
		...parsed.data,
		environment,
		kind,
		config: path,
		output: String(config.pages_build_output_dir ?? '')
	};
	validateTarget(config, value);
	return value;
}

function inferredTarget(
	config: Record<string, unknown>,
	environment: DeploymentEnvironment,
	named: Record<string, unknown> | null
) {
	return {
		...named,
		accountId: named?.account_id ?? config.account_id,
		tokenEnv: `HARNESS_${String(config.name ?? 'PROJECT')
			.replace(/[^a-z0-9]/gi, '_')
			.toUpperCase()}_${environment.toUpperCase()}_CLOUDFLARE_API_TOKEN`,
		healthUrl: named?.health_url,
		branch: ''
	};
}
function validateTarget(config: Record<string, unknown>, value: CloudflareTarget) {
	if (value.kind === 'pages') {
		if (!value.branch) throw new Error(`Explicit Pages branch required for ${value.environment}.`);
		return;
	}
	const env = (config.env ?? {}) as Record<string, Record<string, unknown>>;
	const named = env[value.wranglerEnvironment] ?? {};
	const account = named.account_id ?? config.account_id;
	if (account && account !== value.accountId)
		throw new Error('Wrangler and deployment account mappings differ.');
	if (!value.wranglerEnvironment || named.name !== value.name)
		throw new Error(`Explicit named Worker configuration required for ${value.environment}.`);
}
