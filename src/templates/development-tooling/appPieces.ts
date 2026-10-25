import { toCamelCase, toKebabCase, toPascalCase } from '../../helpers/strings/case';
import type { PlannedFile } from '../../core/development-tooling/files';

export function componentFiles(name: string): PlannedFile[] {
	const componentSymbol = toPascalCase(name);
	const componentName = `${toPascalCase(name)}.svelte`;
	const fileName = toKebabCase(name);

	return [
		{
			path: `src/components/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${componentSymbol}', error }: { label?: string; error?: string } = $props();\n</script>\n\n<section\n\tdata-harness-component="${fileName}"\n\trole="region"\n\taria-label={label}\n\taria-describedby={error ? '${fileName}-error' : undefined}\n>\n\t<h2>{label}</h2>\n\t{#if error}\n\t\t<p id="${fileName}-error" role="alert">{error}</p>\n\t{/if}\n</section>\n`
		},
		{
			path: `src/routes/__harness/components/${fileName}/+page.svelte`,
			contents: `<script lang="ts">\n${previewGuard()}\n\timport { page } from '$app/state';\n\timport ${componentSymbol} from '../../../../components/${componentName}';\n\n${previewCheck()}\n\tconst label = $derived(page.url.searchParams.get('label') ?? undefined);\n\tconst error = $derived(page.url.searchParams.get('error') ?? undefined);\n</script>\n\n<svelte:head>\n\t<title>${componentSymbol} component preview</title>\n</svelte:head>\n\n<${componentSymbol} {label} {error} />\n`
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
	const title = titleName(name);

	return [
		{
			path: `src/routes/${route}/+layout.svelte`,
			contents: `<script lang="ts">\n\timport type { Snippet } from 'svelte';\n\n\tlet { children }: { children?: Snippet } = $props();\n</script>\n\n<section data-harness-layout="${route}">\n\t{#if children}\n\t\t{@render children()}\n\t{/if}\n</section>\n`
		},
		{
			path: `src/routes/${route}/__harness/+page.svelte`,
			contents: `<script lang="ts">\n${previewGuard()}\n\n${previewCheck()}\n</script>\n\n<svelte:head>\n\t<title>${title} layout preview</title>\n</svelte:head>\n\n<div data-harness-layout-content="${route}">\n\t<h2>${title} layout content</h2>\n</div>\n`
		},
		{
			path: `tests/e2e/${route}-layout.spec.ts`,
			contents: layoutContractTest(route, title)
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
			contents: `import { expect, test } from 'vitest';\nimport { ${storeName} } from '../../src/lib/stores/${fileName}.svelte';\n\nconst cases = [\n\t{\n\t\tid: 'initial value is readable',\n\t\tinitialValue: 'first',\n\t\tnextValue: undefined,\n\t\texpected: 'first'\n\t},\n\t{\n\t\tid: 'setting value exposes the new value',\n\t\tinitialValue: 'first',\n\t\tnextValue: 'next',\n\t\texpected: 'next'\n\t}\n] as const;\n\ntest.each(cases)('$id', ({ initialValue, nextValue, expected }) => {\n\tconst store = ${storeName}(initialValue);\n\tif (nextValue !== undefined) store.value = nextValue;\n\texpect(store.value).toBe(expected);\n});\n`
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
			contents: `import { expect, test } from 'vitest';\nimport { ${hookName} } from '../../src/hooks/${hookName}.server';\n\ntest('${hookName} passes the event to resolve', async () => {\n\tconst event = {} as unknown as Parameters<typeof ${hookName}>[0]['event'];\n\tconst response = new Response('resolved');\n\tconst resolve = async (received: typeof event) => {\n\t\texpect(received).toBe(event);\n\t\treturn response;\n\t};\n\tawait expect(${hookName}({ event, resolve } as Parameters<typeof ${hookName}>[0])).resolves.toBe(\n\t\tresponse\n\t);\n});\n`
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
	const componentSymbol = `${toPascalCase(name)}Partial`;
	const componentName = `${componentSymbol}.svelte`;
	const fileName = toKebabCase(name);
	const label = toPascalCase(name);

	return [
		{
			path: `src/components/partials/${componentName}`,
			contents: `<script lang="ts">\n\tlet { label = '${label}' }: { label?: string } = $props();\n</script>\n\n<div data-harness-partial="${fileName}">{label}</div>\n`
		},
		{
			path: `src/routes/__harness/partials/${fileName}/+page.svelte`,
			contents: `<script lang="ts">\n${previewGuard()}\n\timport { page } from '$app/state';\n\timport ${componentSymbol} from '../../../../components/partials/${componentName}';\n\n${previewCheck()}\n\tconst label = $derived(page.url.searchParams.get('label') ?? undefined);\n</script>\n\n<svelte:head>\n\t<title>${label} partial preview</title>\n</svelte:head>\n\n<${componentSymbol} {label} />\n`
		},
		{
			path: `tests/e2e/${fileName}-partial.spec.ts`,
			contents: partialContractTest(fileName, label)
		}
	];
}

function titleName(name: string): string {
	return toPascalCase(name).replace(/([a-z])([A-Z])/g, '$1 $2');
}

function previewGuard(): string {
	return `\timport { dev } from '$app/environment';\n\timport { error as previewError } from '@sveltejs/kit';`;
}

function previewCheck(): string {
	return `\tif (!dev && import.meta.env.MODE !== 'test') {\n\t\tthrow previewError(404, 'Not found');\n\t}`;
}

function componentContractTest(componentName: string, marker: string): string {
	const states = `const states = [\n\t{\n\t\tid: 'rest',\n\t\tpath: '/__harness/components/${marker}',\n\t\tlabel: undefined,\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${marker}-rest`)}\n\t},\n\t{\n\t\tid: 'label-prop',\n\t\tpath: '/__harness/components/${marker}?label=Ready',\n\t\tlabel: 'Ready',\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${marker}-label-prop`)}\n\t},\n\t{\n\t\tid: 'error-prop',\n\t\tpath: '/__harness/components/${marker}?label=Ready&error=Invalid%20label',\n\t\tlabel: 'Ready',\n\t\terror: 'Invalid label',\n\t\tscreenshot: ${screenshotSet(`${marker}-error-prop`)}\n\t}\n] as const;`;
	return screenshotContractTest(`${componentName}.svelte states`, states, 'component', {
		assertions: `const component = page.locator('[data-harness-component="${marker}"]');\n\t\t\tconst label = state.label ?? '${componentName}';\n\t\t\tawait expect(component).toBeVisible();\n\t\t\tawait expect(component).toHaveAttribute('role', 'region');\n\t\t\tawait expect(component).toHaveAttribute('aria-label', label);\n\t\t\tawait expect(page.getByRole('heading', { name: label })).toBeVisible();\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) {\n\t\t\t\tawait expect(alert).toHaveText(state.error);\n\t\t\t\tawait expect(component).toHaveAttribute('aria-describedby', '${marker}-error');\n\t\t\t} else {\n\t\t\t\tawait expect(alert).toHaveCount(0);\n\t\t\t\tawait expect(component).not.toHaveAttribute('aria-describedby');\n\t\t\t}`
	});
}

function pageContractTest(route: string, title: string, kind: 'page' | 'e2e'): string {
	const suite = kind === 'page' ? `${route} view route is generated` : `${route} page loads`;
	const prefix = kind === 'page' ? `${route}-page` : `${route}-e2e`;
	const states = `const states = [\n\t{\n\t\tid: 'default',\n\t\tpath: '/${route}',\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${prefix}-default`)}\n\t},\n\t{\n\t\tid: 'error-state',\n\t\tpath: '/${route}?error=Preview%20error',\n\t\terror: 'Preview error',\n\t\tscreenshot: ${screenshotSet(`${prefix}-error`)}\n\t}\n] as const;`;
	return screenshotContractTest(suite, states, 'page', {
		assertions: `const view = page.locator('[data-harness-view="${route}"]');\n\t\t\tawait expect(view).toBeVisible();\n\t\t\tawait expect(view).toHaveAttribute('aria-labelledby', '${route}-title');\n\t\t\tawait expect(page.getByRole('heading', { name: '${title}' })).toBeVisible();\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) await expect(alert).toHaveText(state.error);\n\t\t\telse await expect(alert).toHaveCount(0)`,
		postCapture: `const home = page.getByRole('link', { name: 'Home' });\n\t\t\tawait page.keyboard.press('Tab');\n\t\t\tawait expect(home).toBeFocused();`
	});
}

function layoutContractTest(route: string, title: string): string {
	const states = `const states = [\n\t{\n\t\tid: 'default',\n\t\tpath: '/${route}/__harness',\n\t\tscreenshot: ${screenshotSet(`${route}-layout-default`)}\n\t}\n] as const;`;
	return screenshotContractTest(`${route} layout frame`, states, 'layout', {
		assertions: `const layout = page.locator('[data-harness-layout="${route}"]');\n\t\t\tconst content = page.getByRole('heading', { name: '${title} layout content' });\n\t\t\tawait expect(layout).toBeVisible();\n\t\t\tawait expect(content).toBeVisible();`
	});
}

function partialContractTest(marker: string, label: string): string {
	const states = `const states = [\n\t{\n\t\tid: 'rest',\n\t\tpath: '/__harness/partials/${marker}',\n\t\tlabel: undefined,\n\t\tscreenshot: ${screenshotSet(`${marker}-partial-rest`)}\n\t},\n\t{\n\t\tid: 'label-prop',\n\t\tpath: '/__harness/partials/${marker}?label=Ready',\n\t\tlabel: 'Ready',\n\t\tscreenshot: ${screenshotSet(`${marker}-partial-label-prop`)}\n\t}\n] as const;`;
	return screenshotContractTest(`${label}Partial.svelte states`, states, 'partial', {
		assertions: `const partial = page.locator('[data-harness-partial="${marker}"]');\n\t\t\tawait expect(partial).toBeVisible();\n\t\t\tawait expect(partial).toHaveText(state.label ?? '${label}');`
	});
}
function screenshotSet(prefix: string): string {
	return `{\n\t\t\tdesktop: '${prefix}-desktop.png',\n\t\t\ttablet: '${prefix}-tablet.png',\n\t\t\tmobile: '${prefix}-mobile.png'\n\t\t}`;
}
const formatContractBlock = (value: string): string =>
	value
		.replace(/\t{3}/g, '')
		.replace(/toHaveCount\(0\)(?!;)/g, 'toHaveCount(0);')
		.replace(/\n/g, '\n\t\t\t\t\t');

function screenshotContractTest(
	suite: string,
	states: string,
	target: 'page' | 'component' | 'layout' | 'partial',
	blocks: { assertions: string; postCapture?: string }
): string {
	const capture =
		target === 'page'
			? "await expect(page).toHaveScreenshot(state.screenshot[viewport.id], {\n\t\t\t\t\t\tfullPage: true,\n\t\t\t\t\t\tanimations: 'disabled',\n\t\t\t\t\t\tcaret: 'hide'\n\t\t\t\t\t});"
			: `await expect(${target}).toHaveScreenshot(state.screenshot[viewport.id], {\n\t\t\t\t\t\tanimations: 'disabled',\n\t\t\t\t\t\tcaret: 'hide'\n\t\t\t\t\t});`;
	const assertions = formatContractBlock(blocks.assertions);
	const postCapture = formatContractBlock(
		blocks.postCapture ?? '// Screenshot baselines are comparison-only; update them deliberately.'
	);
	return `import { expect, test } from './support/browserTest';\nimport type { Page } from '@playwright/test';\n\n${states}\n\nconst viewports = [\n\t{ id: 'desktop', size: { width: 1440, height: 900 } },\n\t{ id: 'tablet', size: { width: 920, height: 800 } },\n\t{ id: 'mobile', size: { width: 390, height: 844 } }\n] as const;\n\nasync function waitForRender(page: Page): Promise<void> {\n\tawait page.waitForLoadState('networkidle');\n\tawait page.waitForFunction(() => document.readyState === 'complete');\n\tawait page.evaluate(async () => {\n\t\tawait document.fonts.ready;\n\t\tawait Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));\n\t});\n}\n\ntest.describe('${suite}', () => {\n\tfor (const viewport of viewports) {\n\t\ttest.describe(viewport.id + ' viewport', () => {\n\t\t\ttest.use({ viewport: viewport.size });\n\n\t\t\tfor (const state of states)\n\t\t\t\ttest(state.id + ' state matches its declared screenshot', async ({ page }) => {\n\t\t\t\t\tawait page.goto(state.path);\n\t\t\t\t\tawait waitForRender(page);\n\t\t\t\t\t${assertions}\n\t\t\t\t\t${capture}\n\t\t\t\t\t${postCapture}\n\t\t\t\t});\n\t\t});\n\t}\n});\n`;
}
