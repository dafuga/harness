export function componentContractTest(componentName: string, marker: string): string {
	const states = `const states = [\n\t{\n\t\tid: 'rest',\n\t\tpath: '/__harness/components/${marker}',\n\t\tlabel: undefined,\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${marker}-rest`)}\n\t},\n\t{\n\t\tid: 'label-prop',\n\t\tpath: '/__harness/components/${marker}?label=Ready',\n\t\tlabel: 'Ready',\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${marker}-label-prop`)}\n\t},\n\t{\n\t\tid: 'error-prop',\n\t\tpath: '/__harness/components/${marker}?label=Ready&error=Invalid%20label',\n\t\tlabel: 'Ready',\n\t\terror: 'Invalid label',\n\t\tscreenshot: ${screenshotSet(`${marker}-error-prop`)}\n\t}\n] as const;`;
	return screenshotContractTest(`${componentName}.svelte states`, states, 'component', {
		assertions: `const component = page.locator('[data-harness-component="${marker}"]');\n\t\t\tconst label = state.label ?? '${componentName}';\n\t\t\tawait expect(component).toBeVisible();\n\t\t\tawait expect(component).toHaveAttribute('role', 'region');\n\t\t\tawait expect(component).toHaveAttribute('aria-label', label);\n\t\t\tawait expect(page.getByRole('heading', { name: label })).toBeVisible();\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) {\n\t\t\t\tawait expect(alert).toHaveText(state.error);\n\t\t\t\tawait expect(component).toHaveAttribute('aria-describedby', '${marker}-error');\n\t\t\t} else {\n\t\t\t\tawait expect(alert).toHaveCount(0);\n\t\t\t\tawait expect(component).not.toHaveAttribute('aria-describedby');\n\t\t\t}`
	});
}

export function pageContractTest(route: string, title: string, kind: 'page' | 'e2e'): string {
	const suite = kind === 'page' ? `${route} view route is generated` : `${route} page loads`;
	const prefix = kind === 'page' ? `${route}-page` : `${route}-e2e`;
	const states = `const states = [\n\t{\n\t\tid: 'default',\n\t\tpath: '/${route}',\n\t\terror: undefined,\n\t\tscreenshot: ${screenshotSet(`${prefix}-default`)}\n\t},\n\t{\n\t\tid: 'error-state',\n\t\tpath: '/${route}?error=Preview%20error',\n\t\terror: 'Preview error',\n\t\tscreenshot: ${screenshotSet(`${prefix}-error`)}\n\t}\n] as const;`;
	return screenshotContractTest(suite, states, 'page', {
		assertions: `const view = page.locator('[data-harness-view="${route}"]');\n\t\t\tawait expect(view).toBeVisible();\n\t\t\tawait expect(view).toHaveAttribute('aria-labelledby', '${route}-title');\n\t\t\tawait expect(page.getByRole('heading', { name: '${title}' })).toBeVisible();\n\t\t\tconst alert = page.getByRole('alert');\n\t\t\tif (state.error) await expect(alert).toHaveText(state.error);\n\t\t\telse await expect(alert).toHaveCount(0)`,
		postCapture: `const home = page.getByRole('link', { name: 'Home' });\n\t\t\tawait page.keyboard.press('Tab');\n\t\t\tawait expect(home).toBeFocused();`
	});
}

export function layoutContractTest(route: string, title: string): string {
	const states = `const states = [\n\t{\n\t\tid: 'default',\n\t\tpath: '/${route}/__harness',\n\t\tscreenshot: ${screenshotSet(`${route}-layout-default`)}\n\t}\n] as const;`;
	return screenshotContractTest(`${route} layout frame`, states, 'layout', {
		assertions: `const layout = page.locator('[data-harness-layout="${route}"]');\n\t\t\tconst content = layout.locator('[data-harness-layout-content="${route}"]');\n\t\t\tconst heading = content.getByRole('heading', { name: '${title} layout content' });\n\t\t\tawait expect(layout).toBeVisible();\n\t\t\tawait expect(content).toBeVisible();\n\t\t\tawait expect(heading).toBeVisible();\n\t\t\tawait expect(content).toContainText('Child content placeholder');`
	});
}

export function partialContractTest(marker: string, label: string): string {
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
		.replace(/\n/g, '\n\t');

function screenshotContractTest(
	suite: string,
	states: string,
	target: 'page' | 'component' | 'layout' | 'partial',
	blocks: { assertions: string; postCapture?: string }
): string {
	const capture =
		target === 'page' || target === 'layout'
			? "await matchScreenshot(page, state.screenshot[viewport.id], {\n\t\tfullPage: true,\n\t\tanimations: 'disabled',\n\t\tcaret: 'hide'\n\t});"
			: `await matchScreenshot(${target}, state.screenshot[viewport.id], {\n\t\tanimations: 'disabled',\n\t\tcaret: 'hide'\n\t});`;
	const assertions = formatContractBlock(blocks.assertions);
	const postCapture = formatContractBlock(
		blocks.postCapture ?? '// Screenshot baselines are comparison-only; update them deliberately.'
	);
	const groups = visualGroups(target);
	return `import type { Page } from '@playwright/test';\nimport { expect, test } from './support/browserTest';\nimport type { MatchScreenshot } from './support/browserTest.types';\n\n${states}\n\nconst viewports = [\n\t{ id: 'desktop', size: { width: 1440, height: 900 } },\n\t{ id: 'tablet', size: { width: 920, height: 800 } },\n\t{ id: 'mobile', size: { width: 390, height: 844 } }\n] as const;\n\ntest.describe('${suite}', () => {\n${groups}\n});\n\nasync function runState(\n\tpage: Page,\n\tmatchScreenshot: MatchScreenshot,\n\tstate: (typeof states)[number],\n\tviewport: (typeof viewports)[number]\n): Promise<void> {\n\tawait page.goto(state.path);\n\t${assertions}\n\t${capture}\n\t${postCapture}\n}\n`;
}

function visualGroups(target: 'page' | 'component' | 'layout' | 'partial'): string {
	const states = {
		page: ['default', 'error-state'],
		component: ['rest', 'label-prop', 'error-prop'],
		layout: ['default'],
		partial: ['rest', 'label-prop']
	}[target];
	return ['desktop', 'tablet', 'mobile']
		.map((name, index) => {
			const cases = states
				.map(
					(state, row) =>
						`\t\ttest('${state}', async ({ page, matchScreenshot }) => {\n\t\t\tawait runState(page, matchScreenshot, states[${row}], viewport);\n\t\t});`
				)
				.join('\n');
			return `\ttest.describe('${name} viewport', () => {\n\t\tconst viewport = viewports[${index}];\n\t\ttest.use({ viewport: viewport.size });\n\n${cases}\n\t});`;
		})
		.join('\n\n');
}
