import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { IpcRequestValidator } from '../src/validators/IpcRequestValidator';
import { NavigationValidator } from '../src/validators/NavigationValidator';
import { scrubEnvironment } from '../src/utils/cli-environment/scrubEnvironment';
import { publicCliEvents } from '../src/adapters/claude-cli-adapter/publicCliEvents';

test('remote pages and child frames cannot use the project bridge', () => {
	const gate = new NavigationValidator();
	expect(gate.validate('harness://app/harness')).toBe(true);
	expect(gate.validate('https://example.com')).toBe(false);
	expect(gate.validate('harness://evil/harness')).toBe(false);
	expect(gate.validate('file:///tmp/unknown.html')).toBe(false);
});

test('IPC refuses unknown operations, invalid regions and unapproved changes', () => {
	const gate = new IpcRequestValidator();
	expect(
		gate.parse('plan:create', { category: 'pages', title: 'Activity', goal: 'Show work' })
	).toEqual({ category: 'pages', title: 'Activity', goal: 'Show work' });
	expect(() => gate.parse('shell:run', { command: 'echo hi' })).toThrow();
	expect(() =>
		gate.parse('thread:open', {
			entityId: 'page.activity',
			version: 'v001',
			imageSha256: 'a'.repeat(64),
			state: 'default',
			viewport: 'desktop',
			region: { x: 0.9, y: 0, width: 0.5, height: 1 }
		})
	).toThrow();
	expect(() =>
		gate.parse('run:start', {
			mode: 'change',
			provider: 'codex',
			model: 'gpt-6-astra',
			effort: 'medium',
			entityId: 'page.activity',
			threadId: 'draft',
			text: 'Implement this',
			approval: null
		})
	).toThrow();
});

test('feature design preparation binds its proposal to one selected project revision', () => {
	const gate = new IpcRequestValidator(),
		commit = 'a'.repeat(40),
		input = {
			projectId: 'local-' + 'b'.repeat(64), sourceCommit: commit, originalRequest: 'Change the right panel.',
			proposal: { feature: 'feature', sourceCommit: commit, goal: 'Improve the page.', tldr: 'Design then build.', changes: [], tasks: [] },
			pageDesigns: []
		};
	expect(gate.parse('feature-plan:prepare', input)).toEqual(input);
	expect(() => gate.parse('feature-plan:prepare', { ...input, proposal: { ...input.proposal, sourceCommit: 'c'.repeat(40) } })).toThrow();
	expect(() => gate.parse('feature-plan:prepare', { ...input, extra: true })).toThrow();
});

test('subscription subprocesses omit API overrides without changing the parent', () => {
	const env = {
		PATH: '/bin',
		OPENAI_API_KEY: 'synthetic',
		ANTHROPIC_BASE_URL: 'synthetic',
		CLOUDFLARE_API_TOKEN: 'synthetic',
		HARNESS_FIXTURE_DEV_CLOUDFLARE_API_TOKEN: 'synthetic',
		CLOUDFLARE_ENV: 'prod'
	};
	expect(scrubEnvironment(env)).toEqual({ PATH: '/bin' });
	expect(env.OPENAI_API_KEY).toBe('synthetic');
});

test('private reasoning is never forwarded to the renderer', () => {
	expect(publicCliEvents({ type: 'reasoning', text: 'PRIVATE' })).toEqual([]);
	expect(
		publicCliEvents({
			type: 'assistant',
			message: {
				content: [
					{ type: 'thinking', thinking: 'PRIVATE' },
					{ type: 'text', text: 'Design is ready.' }
				]
			}
		})
	).toEqual(['Design is ready.']);
});

function sources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return /\.(ts|js|svelte)$/.test(path) ? [path] : [];
	});
}

test('portable workspace sources must not depend on the Hub app', () => {
	const desktop = resolve(import.meta.dirname, '..');
	const hub = resolve(desktop, '../hub');
	const dependencies = sources(resolve(desktop, 'src')).flatMap((path) => {
		const imports = [
			...readFileSync(path, 'utf8').matchAll(
				/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
			)
		];
		return imports
			.filter(([, specifier]) => {
				const target = resolve(dirname(path), specifier);
				return target === hub || target.startsWith(`${hub}/`) || /^hub(?:\/|$)/.test(specifier);
			})
			.map(([, specifier]) => `${path.slice(desktop.length + 1)} -> ${specifier}`);
	});
	const aliases = readFileSync(resolve(desktop, 'svelte.config.js'), 'utf8');
	const upwardAliases = [...aliases.matchAll(/['"]([^'"]*\.\.\/hub(?:\/[^'"]*)?)['"]/g)].map(
		([, target]) => `Svelte alias -> ${target}`
	);
	expect(
		[...dependencies, ...upwardAliases],
		'portable workspace sources must not depend on the Hub app'
	).toEqual([]);
});
