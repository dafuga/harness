import { toCamelCase, toKebabCase, toPascalCase } from '../core/case';
import type { PlannedFile } from '../core/files';

export function componentFiles(name: string): PlannedFile[] {
	const componentName = `${toPascalCase(name)}.svelte`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/components/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${toPascalCase(name)}' }: { label?: string } = $props();\n</script>\n\n<section data-frame-component="${fileName}">\n\t<h2>{label}</h2>\n</section>\n`
		},
		{
			path: `test/components/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${componentName} is generated', () => {\n\texpect('${componentName}').toContain('.svelte');\n});\n`
		}
	];
}

export function viewFiles(name: string): PlannedFile[] {
	const title = titleName(name);
	const route = toKebabCase(name);

	return [
		{
			path: `src/routes/${route}/+page.svelte`,
			contents: `<script lang="ts">\n\tconst title = '${title}';\n</script>\n\n<svelte:head>\n\t<title>{title}</title>\n</svelte:head>\n\n<section data-frame-view="${route}">\n\t<h1>{title}</h1>\n</section>\n`
		},
		{
			path: `test/routes/${route}-view.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${route} view route is generated', () => {\n\texpect('src/routes/${route}/+page.svelte').toContain('${route}');\n});\n`
		}
	];
}

export function layoutFiles(name: string): PlannedFile[] {
	const route = toKebabCase(name);

	return [
		{
			path: `src/routes/${route}/+layout.svelte`,
			contents: `<script lang="ts">\n\timport type { Snippet } from 'svelte';\n\n\tlet { children }: { children?: Snippet } = $props();\n</script>\n\n<section data-frame-layout="${route}">\n\t{#if children}\n\t\t{@render children()}\n\t{/if}\n</section>\n`
		},
		{
			path: `test/routes/${route}-layout.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${route} layout route is generated', () => {\n\texpect('src/routes/${route}/+layout.svelte').toContain('${route}');\n});\n`
		}
	];
}

export function apiFiles(name: string): PlannedFile[] {
	const route = toKebabCase(name);

	return [
		{
			path: `src/routes/api/${route}/+server.ts`,
			contents: `import { json } from '@sveltejs/kit';\n\nexport function GET(): Response {\n\treturn json({ ok: true, resource: '${route}' });\n}\n`
		},
		{
			path: `test/routes/${route}-api.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { GET } from '../../src/routes/api/${route}/+server';\n\ntest('${route} API returns ok', async () => {\n\tconst response = GET();\n\texpect(await response.json()).toEqual({ ok: true, resource: '${route}' });\n});\n`
		}
	];
}

export function storeFiles(name: string): PlannedFile[] {
	const storeName = `create${toPascalCase(name)}Store`;
	const fileName = toCamelCase(name);
	const kebabName = toKebabCase(name);

	return [
		{
			path: `src/lib/stores/${fileName}.svelte.ts`,
			contents: `export function ${storeName}(initialValue = '') {\n\tlet value = $state(initialValue);\n\n\treturn {\n\t\tget value(): string {\n\t\t\treturn value;\n\t\t},\n\t\tset value(nextValue: string) {\n\t\t\tvalue = nextValue;\n\t\t}\n\t};\n}\n`
		},
		{
			path: `test/stores/${kebabName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${storeName} } from '../../src/lib/stores/${fileName}.svelte';\n\ntest('${storeName} stores values', () => {\n\tconst store = ${storeName}('first');\n\tstore.value = 'next';\n\texpect(store.value).toBe('next');\n});\n`
		}
	];
}

export function hookFiles(name: string): PlannedFile[] {
	const hookName = `${toCamelCase(name)}Hook`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/hooks/${hookName}.server.ts`,
			contents: `import type { Handle } from '@sveltejs/kit';\n\nexport const ${hookName}: Handle = async ({ event, resolve }) => {\n\treturn resolve(event);\n};\n`
		},
		{
			path: `test/hooks/${fileName}.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { ${hookName} } from '../../src/hooks/${hookName}.server';\n\ntest('${hookName} is a SvelteKit handle', () => {\n\texpect(${hookName}).toBeTypeOf('function');\n});\n`
		}
	];
}

export function e2eFiles(name: string): PlannedFile[] {
	const route = toKebabCase(name);

	return [
		{
			path: `tests/e2e/${route}.spec.ts`,
			contents: `import { expect, test } from '@playwright/test';\n\ntest('${route} page loads', async ({ page }) => {\n\tawait page.goto('/${route}');\n\tawait expect(page.locator('[data-frame-view="${route}"]')).toBeVisible();\n});\n`
		}
	];
}

function titleName(name: string): string {
	return toPascalCase(name).replace(/([a-z])([A-Z])/g, '$1 $2');
}
