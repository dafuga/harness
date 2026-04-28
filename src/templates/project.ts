import type { PlannedFile } from '../core/files';

export type ProjectKind = 'app' | 'lib';

export interface ProjectTemplateInput {
	name: string;
	kind: ProjectKind;
}

export function projectFiles(input: ProjectTemplateInput): PlannedFile[] {
	return input.kind === 'app' ? appFiles(input.name) : libFiles(input.name);
}

function appFiles(name: string): PlannedFile[] {
	return [
		{
			path: 'package.json',
			contents: JSON.stringify(appPackage(name), null, '\t') + '\n'
		},
		{
			path: 'README.md',
			contents: `# ${name}\n\nA Frame SvelteKit app with small files, specs, tests, and adapters.\n`
		},
		{
			path: 'svelte.config.js',
			contents:
				"import adapter from '@sveltejs/adapter-auto';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n\nexport default {\n\tkit: {\n\t\tadapter: adapter()\n\t},\n\tpreprocess: vitePreprocess()\n};\n"
		},
		{
			path: 'vite.config.ts',
			contents:
				"import { sveltekit } from '@sveltejs/kit/vite';\nimport { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n\tplugins: [sveltekit()],\n\ttest: {\n\t\tinclude: ['test/**/*.test.ts']\n\t}\n});\n"
		},
		{
			path: 'tsconfig.json',
			contents:
				'{\n\t"extends": "./.svelte-kit/tsconfig.json",\n\t"compilerOptions": {\n\t\t"strict": true,\n\t\t"moduleResolution": "bundler",\n\t\t"skipLibCheck": true\n\t}\n}\n'
		},
		{
			path: 'src/app.html',
			contents:
				'<!doctype html>\n<html lang="en">\n\t<head>\n\t\t<meta charset="utf-8" />\n\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />\n\t\t%sveltekit.head%\n\t</head>\n\t<body data-sveltekit-preload-data="hover">\n\t\t<div>%sveltekit.body%</div>\n\t</body>\n</html>\n'
		},
		{
			path: 'AGENTS.md',
			contents: agentRules('SvelteKit app')
		},
		{
			path: 'specification/README.md',
			contents: specificationReadme()
		},
		{
			path: 'src/routes/+page.svelte',
			contents: `<script lang="ts">\n\tconst title = 'Welcome to ${name}';\n</script>\n\n<h1>{title}</h1>\n`
		},
		{
			path: 'src/lib/adapters/README.md',
			contents: 'Persistence adapters live here. Generate models with `frame generate model`.\n'
		},
		{
			path: 'test/smoke.test.ts',
			contents:
				"import { expect, test } from 'vitest';\n\ntest('Frame app scaffold is ready', () => {\n\texpect(true).toBe(true);\n});\n"
		}
	];
}

function libFiles(name: string): PlannedFile[] {
	return [
		{
			path: 'package.json',
			contents: JSON.stringify(libPackage(name), null, '\t') + '\n'
		},
		{
			path: 'README.md',
			contents: `# ${name}\n\nA Frame Bun TypeScript library.\n`
		},
		{
			path: 'tsconfig.json',
			contents:
				'{\n\t"compilerOptions": {\n\t\t"target": "ES2022",\n\t\t"module": "ESNext",\n\t\t"moduleResolution": "Bundler",\n\t\t"strict": true,\n\t\t"skipLibCheck": true,\n\t\t"types": ["bun-types"]\n\t},\n\t"include": ["src/**/*.ts", "test/**/*.ts"]\n}\n'
		},
		{
			path: 'AGENTS.md',
			contents: agentRules('Bun TypeScript library')
		},
		{
			path: 'src/index.ts',
			contents: "export function helloFrame(): string {\n\treturn 'hello from Frame';\n}\n"
		},
		{
			path: 'test/index.test.ts',
			contents:
				"import { expect, test } from 'vitest';\nimport { helloFrame } from '../src';\n\ntest('returns a greeting', () => {\n\texpect(helloFrame()).toBe('hello from Frame');\n});\n"
		}
	];
}

function appPackage(name: string): Record<string, unknown> {
	return {
		name,
		version: '0.1.0',
		private: true,
		type: 'module',
		scripts: {
			dev: 'vite dev --host --port 3322',
			build: 'vite build',
			check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
			test: 'vitest run'
		},
		devDependencies: {
			'@sveltejs/adapter-auto': '^4.0.0',
			'@sveltejs/kit': '^2.16.1',
			'@sveltejs/vite-plugin-svelte': '^5.0.0',
			'svelte-check': '^4.0.0',
			svelte: '^5.0.0',
			typescript: '^5.8.3',
			vite: '^6.2.5',
			vitest: '^3.1.2'
		}
	};
}

function libPackage(name: string): Record<string, unknown> {
	return {
		name,
		version: '0.1.0',
		type: 'module',
		scripts: {
			build: 'bun build src/index.ts --target bun --outdir dist',
			check: 'tsc --noEmit',
			test: 'vitest run'
		},
		devDependencies: {
			'@types/bun': '^1.2.18',
			typescript: '^5.8.3',
			vitest: '^3.1.2'
		}
	};
}

function agentRules(projectType: string): string {
	return `# AGENTS.md\n\nThis is a Frame ${projectType}.\n\n- Keep files small and focused.\n- Add or update a feature spec before implementation.\n- Prefer generated controllers, models, services, decorators, and tests.\n- Run relevant checks before handing work back.\n- Ask \`frame info <topic>\` before adding unfamiliar code.\n`;
}

function specificationReadme(): string {
	return `# Specification\n\nFeature files define delivery scope.\n\nRequired sections:\n\n1. # Feature: <name>\n2. ## Overview\n3. ## Acceptance Criteria\n4. ## Future Enhancements\n`;
}
