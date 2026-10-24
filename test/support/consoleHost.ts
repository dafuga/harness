import type { Page } from '@playwright/test';
import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** Sessions of the synthetic host; they are fixture strings, not credentials of anything. */
export const sessions = { admin: 'synthetic-admin-session', member: 'synthetic-member-session' };

const installed = (name: string): string => {
	const manifest = resolve(import.meta.dirname, '../../node_modules', name, 'package.json');
	return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version;
};
const tooling = [
	'@sveltejs/adapter-cloudflare',
	'@sveltejs/adapter-static',
	'@sveltejs/kit',
	'@sveltejs/vite-plugin-svelte',
	'svelte',
	'vite'
];

/** What the host served at /harness before the console was installed: its own, unprotected page. */
export const hostRoute = {
	path: 'src/routes/harness/+server.ts',
	contents: "export const GET = (): Response => new Response('The host wrote this page.');\n"
};

// As in the template: the Cloudflare adapter for the web, the static adapter for the mobile shell.
const svelteConfig = [
	"import adapterCloudflare from '@sveltejs/adapter-cloudflare';",
	"import adapterStatic from '@sveltejs/adapter-static';",
	'',
	"const isMobileBuild = process.env.BUILD_TARGET === 'mobile';",
	"const shell = { pages: 'build', assets: 'build', fallback: undefined, precompress: false, strict: false };",
	"const prerender = { entries: [], handleHttpError: 'warn', handleMissingId: 'warn' };",
	'',
	'export default {',
	'\tcompiler: { runes: true },',
	'\tkit: {',
	"\t\tadapter: isMobileBuild ? adapterStatic(shell) : adapterCloudflare({ config: 'wrangler.toml' }),",
	'\t\tcsrf: { checkOrigin: false },',
	'\t\t...(isMobileBuild && { prerender })',
	'\t}',
	'};',
	''
].join('\n');

const hooks = [
	"import type { Handle } from '@sveltejs/kit';",
	'',
	'// Stands in for the host session lookup: it reads its own cookie and nothing else.',
	"const users: Record<string, { id: string; role: 'admin' | 'user' }> = {",
	`\t'${sessions.admin}': { id: '1', role: 'admin' },`,
	`\t'${sessions.member}': { id: '2', role: 'user' }`,
	'};',
	'',
	'export const handle: Handle = ({ event, resolve }) => {',
	"\tevent.locals.user = users[event.cookies.get('session') ?? ''];",
	'\treturn resolve(event);',
	'};',
	''
].join('\n');
const policy = [
	"import type { ConsoleRequest } from '@dafuga01/harness/console';",
	'',
	'/** Only a signed-in administrator of this application may see its history. */',
	'export function harnessPolicy(event: ConsoleRequest): boolean {',
	"\treturn (event.locals as App.Locals | undefined)?.user?.role === 'admin';",
	'}',
	''
].join('\n');

/**
 * A small application laid out like the normal template: SvelteKit with the Cloudflare adapter
 * configured from wrangler.toml, a hook that puts the signed-in user on `event.locals`, and a
 * server-only policy that admits administrators.
 */
function sources(tarball: string): Record<string, string> {
	const devDependencies = Object.fromEntries(tooling.map((name) => [name, installed(name)]));
	const dependencies = { '@dafuga01/harness': `file:${tarball}` };
	const manifest = { name: 'synthetic-host', private: true, type: 'module' };
	return {
		'package.json': JSON.stringify({ ...manifest, dependencies, devDependencies }),
		'svelte.config.js': svelteConfig,
		'vite.config.js':
			"import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit()] };\n",
		'wrangler.toml': [
			'name = "synthetic-host"',
			'pages_build_output_dir = ".svelte-kit/cloudflare"',
			'compatibility_date = "2024-07-15"',
			'compatibility_flags = ["nodejs_compat_v2"]',
			''
		].join('\n'),
		'static/robots.txt': 'User-agent: *\nDisallow: /harness\n',
		'src/app.html':
			'<!doctype html><html lang="en"><head>%sveltekit.head%</head><body>%sveltekit.body%</body></html>\n',
		'src/app.d.ts':
			"declare global {\n\tnamespace App {\n\t\tinterface Locals {\n\t\t\tuser?: { id: string; role: 'admin' | 'user' };\n\t\t}\n\t}\n}\nexport {};\n",
		'src/hooks.server.ts': hooks,
		'src/lib/server/harnessPolicy.ts': policy,
		[hostRoute.path]: hostRoute.contents,
		'src/routes/+page.svelte': '<h1>Synthetic host</h1>\n<p>Public page of the host.</p>\n'
	};
}

export async function writeConsoleHost(directory: string, tarball: string): Promise<void> {
	for (const [path, contents] of Object.entries(sources(tarball))) {
		await mkdir(dirname(join(directory, path)), { recursive: true });
		await writeFile(join(directory, path), contents);
	}
}

/** New Code destinations use the installed host's current scope and revision. */
export async function visitCodeCatalogs(page: Page, base: string, head: string) {
	const bar = page.getByRole('banner');
	const tabs = bar.getByRole('tablist', { name: 'Code categories' });
	for (const [label, path] of [
		['Dependencies', 'dependencies'],
		['Configs', 'configs'],
		['Styles', 'styles']
	]) {
		await tabs.getByRole('tab', { name: label, exact: true }).click();
		await page.waitForURL(`**${base}${path}`);
		await page.getByRole('heading', { level: 1, name: label, exact: true }).waitFor();
		expect(await bar.getByRole('combobox', { name: 'Commit', exact: true }).inputValue()).toBe(
			head
		);
	}
	await tabs.getByRole('tab', { name: 'Helpers', exact: true }).click();
	await page.waitForURL(`**${base}functions`);
}
