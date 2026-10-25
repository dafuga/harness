import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import type { PlannedFile } from '../../core/development-tooling/files';

export function componentFiles(name: string): PlannedFile[] {
	const componentSymbol = toPascalCase(name);
	const componentName = `${toPascalCase(name)}.svelte`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/components/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${componentSymbol}', error }: { label?: string; error?: string } = $props();\n\tlet expanded = $state(false);\n</script>\n\n<section\n\tdata-harness-component="${fileName}"\n\trole="region"\n\taria-label={label}\n\taria-describedby={error ? '${fileName}-error' : undefined}\n>\n\t<h2>{label}</h2>\n\t<button\n\t\ttype="button"\n\t\taria-expanded={expanded}\n\t\taria-controls="${fileName}-details"\n\t\tonclick={() => (expanded = !expanded)}\n\t>\n\t\tToggle details\n\t</button>\n\t{#if expanded}\n\t\t<p id="${fileName}-details">Details for {label}.</p>\n\t{/if}\n\t{#if error}\n\t\t<p id="${fileName}-error" role="alert">{error}</p>\n\t{/if}\n</section>\n`
		},
		{
			path: `src/routes/__harness/components/${fileName}/+page.svelte`,
			contents: `<script lang="ts">\n\timport { page } from '$app/state';\n\timport ${componentSymbol} from '../../../../components/${componentName}';\n\n\tconst error = $derived(page.url.searchParams.get('error') ?? undefined);\n</script>\n\n<svelte:head>\n\t<title>${componentSymbol} component preview</title>\n</svelte:head>\n\n<${componentSymbol} {error} />\n`
		},
		{
			path: `tests/e2e/${fileName}-component.spec.ts`,
			contents: componentContractTest(componentSymbol, fileName)
		}
	];
}

export function viewFiles(name: string): PlannedFile[] {
	const title = titleName(name);
	const route = toKebabCase(name);

	return [
		{
			path: `src/routes/${route}/+page.svelte`,
			contents: `<script lang="ts">\n\timport { page } from '$app/state';\n\n\tconst title = '${title}';\n\tconst error = $derived(page.url.searchParams.get('error') ?? undefined);\n</script>\n\n<svelte:head>\n\t<title>{title}</title>\n</svelte:head>\n\n<section data-harness-view="${route}" aria-labelledby="${route}-title">\n\t<h1 id="${route}-title">{title}</h1>\n\t{#if error}\n\t\t<p id="${route}-error" role="alert">{error}</p>\n\t{/if}\n\t<a href="/">Home</a>\n</section>\n`
		},
		{
			path: `tests/e2e/${route}-page.spec.ts`,
			contents: pageContractTest(route, title, 'page')
		}
	];
}

export function layoutFiles(name: string): PlannedFile[] {
	const route = toKebabCase(name);

	return [
		{
			path: `src/routes/${route}/+layout.svelte`,
			contents: `<script lang="ts">\n\timport type { Snippet } from 'svelte';\n\n\tlet { children }: { children?: Snippet } = $props();\n</script>\n\n<section data-harness-layout="${route}">\n\t{#if children}\n\t\t{@render children()}\n\t{/if}\n</section>\n`
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
			contents: `import { json, type RequestEvent } from '@sveltejs/kit';\n\nexport function GET(\n\t{ url }: Pick<RequestEvent, 'url'> = { url: new URL('http://localhost') }\n): Response {\n\tconst label = url.searchParams.get('label') ?? '${route}';\n\tconst error = url.searchParams.get('error');\n\tif (error) return json({ ok: false, resource: '${route}', label, error }, { status: 400 });\n\treturn json({ ok: true, resource: '${route}', label });\n}\n`
		},
		{
			path: `test/routes/${route}-api.test.ts`,
			contents: `import { expect, test } from 'vitest';\nimport { GET } from '../../src/routes/api/${route}/+server';\n\nconst cases = [\n\t{\n\t\tid: 'default props succeed',\n\t\tevent: { url: new URL('http://localhost/api/${route}') },\n\t\texpected: {\n\t\t\tstatus: 200,\n\t\t\theaders: { contentType: 'application/json' },\n\t\t\tbody: { ok: true, resource: '${route}', label: '${route}' }\n\t\t}\n\t},\n\t{\n\t\tid: 'label prop succeeds',\n\t\tevent: { url: new URL('http://localhost/api/${route}?label=Ready') },\n\t\texpected: {\n\t\t\tstatus: 200,\n\t\t\theaders: { contentType: 'application/json' },\n\t\t\tbody: { ok: true, resource: '${route}', label: 'Ready' }\n\t\t}\n\t},\n\t{\n\t\tid: 'error prop returns complete JSON',\n\t\tevent: { url: new URL('http://localhost/api/${route}?label=Ready&error=Unsupported') },\n\t\texpected: {\n\t\t\tstatus: 400,\n\t\t\theaders: { contentType: 'application/json' },\n\t\t\tbody: { ok: false, resource: '${route}', label: 'Ready', error: 'Unsupported' }\n\t\t}\n\t}\n] as const;\n\ntest.each(cases)('$id', async ({ event, expected }) => {\n\tconst response = GET(event);\n\tconst actual = {\n\t\tstatus: response.status,\n\t\theaders: { contentType: response.headers.get('content-type') },\n\t\tbody: await response.json()\n\t};\n\texpect(actual).toEqual(expected);\n});\n`
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
			contents: pageContractTest(route, titleName(name), 'e2e')
		}
	];
}

export function partialFiles(name: string): PlannedFile[] {
	const componentName = `${toPascalCase(name)}Partial.svelte`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/components/partials/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${toPascalCase(name)}' }: { label?: string } = $props();\n</script>\n\n<div data-harness-partial="${fileName}">{label}</div>\n`
		},
		{
			path: `test/components/${fileName}-partial.test.ts`,
			contents: `import { expect, test } from 'vitest';\n\ntest('${componentName} is generated', () => {\n\texpect('${componentName}').toContain('Partial.svelte');\n});\n`
		}
	];
}

function titleName(name: string): string {
	return toPascalCase(name).replace(/([a-z])([A-Z])/g, '$1 $2');
}

function componentContractTest(componentName: string, marker: string): string {
	return `import { expect, test } from './support/browserTest';\n\nconst states = [\n\t{\n\t\tid: 'rest',\n\t\tpath: '/__harness/components/${marker}',\n\t\tscreenshot: '${marker}-rest.png',\n\t\tinteraction: undefined,\n\t\terror: undefined\n\t},\n\t{\n\t\tid: 'interaction-expanded',\n\t\tpath: '/__harness/components/${marker}',\n\t\tinteraction: 'toggle-details',\n\t\tscreenshot: '${marker}-expanded.png',\n\t\terror: undefined\n\t},\n\t{\n\t\tid: 'error-prop',\n\t\tpath: '/__harness/components/${marker}?error=Invalid%20label',\n\t\terror: 'Invalid label',\n\t\tscreenshot: '${marker}-error-prop.png',\n\t\tinteraction: undefined\n\t}\n] as const;\n\ntest.describe('${componentName}.svelte is generated', () => {\n\tfor (const state of states)\n\t\ttest(state.id + ' state matches its declared screenshot', async ({ page }) => {\n\t\t\tawait page.goto(state.path);\n\t\t\tconst component = page.locator('[data-harness-component="${marker}"]');\n\t\t\tconst toggle = page.getByRole('button', { name: 'Toggle details' });\n\t\t\tawait expect(component).toBeVisible();\n\t\t\tawait expect(component).toHaveAttribute('role', 'region');\n\t\t\tawait expect(page.getByRole('heading', { name: '${componentName}' })).toBeVisible();\n\t\t\tif (state.interaction === 'toggle-details') {\n\t\t\t\tawait toggle.click();\n\t\t\t\tawait expect(toggle).toHaveAttribute('aria-expanded', 'true');\n\t\t\t}\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) await expect(alert).toHaveText(state.error);\n\t\t\telse await expect(alert).toHaveCount(0);\n\t\t\tawait expect(component).toHaveScreenshot(state.screenshot);\n\t\t\tawait toggle.focus();\n\t\t\tawait page.keyboard.press('Enter');\n\t\t\tawait expect(toggle).toBeFocused();\n\t\t\tawait expect(toggle).toHaveAttribute(\n\t\t\t\t'aria-expanded',\n\t\t\t\tstate.interaction === 'toggle-details' ? 'false' : 'true'\n\t\t\t);\n\t\t});\n});\n`;
}

function pageContractTest(route: string, title: string, kind: 'page' | 'e2e'): string {
	const suite = kind === 'page' ? `${route} view route is generated` : `${route} page loads`;
	const prefix = kind === 'page' ? `${route}-page` : `${route}-e2e`;
	return `import { expect, test } from './support/browserTest';\n\nconst states = [\n\t{ id: 'default', path: '/${route}', screenshot: '${prefix}-default.png', error: undefined },\n\t{\n\t\tid: 'error-state',\n\t\tpath: '/${route}?error=Preview%20error',\n\t\terror: 'Preview error',\n\t\tscreenshot: '${prefix}-error.png'\n\t}\n] as const;\n\ntest.describe('${suite}', () => {\n\tfor (const state of states)\n\t\ttest(state.id + ' state matches its declared screenshot', async ({ page }) => {\n\t\t\tawait page.goto(state.path);\n\t\t\tconst view = page.locator('[data-harness-view="${route}"]');\n\t\t\tawait expect(view).toBeVisible();\n\t\t\tawait expect(view).toHaveAttribute('aria-labelledby', '${route}-title');\n\t\t\tawait expect(page.getByRole('heading', { name: '${title}' })).toBeVisible();\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) await expect(alert).toHaveText(state.error);\n\t\t\telse await expect(alert).toHaveCount(0);\n\t\t\tawait expect(view).toHaveScreenshot(state.screenshot);\n\t\t\tconst home = page.getByRole('link', { name: 'Home' });\n\t\t\tawait page.keyboard.press('Tab');\n\t\t\tawait expect(home).toBeFocused();\n\t\t});\n});\n`;
}
