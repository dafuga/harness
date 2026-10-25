import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ExplorerModulesScreen from '../../../src/components/module-system/ExplorerModulesScreen.svelte';
import { hostProps } from '../../entityRender';
import { modulePreview } from '../../../tests/e2e/support/component-previews/modules';
import { measureWorkload } from '../../../../../test/support/measureWorkload';

test('module library presents real definitions, installation state and generator instructions', async () => {
	const html = await measureWorkload(
		'reports.component.module-system-explorer-modules-screen',
		'render-module-library',
		() => render(ExplorerModulesScreen, { props: modulePreview(hostProps('commit')) }).body
	);
	expect(html).toContain('Email');
	expect(html).toContain('Offline');
	expect(html).toContain('Installed');
	expect(html).toContain('harness plugin add offline');
	expect(html).toContain('Plugins');
	for (const title of [
		'Layouts',
		'Components',
		'Models',
		'Services',
		'Helpers',
		'Types',
		'Configs',
		'Styles',
		'Dependencies',
		'Users &amp; Permissions'
	])
		expect(html).not.toContain(`>${title}</a>`);
	expect(html).toContain('Playwright');
	expect(html).toContain('Headless audio');
	const detail = render(ExplorerModulesScreen, {
		props: modulePreview(hostProps('commit'), 'email')
	}).body;
	expect(detail).toContain('RESEND_API_KEY');
	expect(detail).toContain('Emails');
	expect(detail).toContain('harness plugin generate email email');
});
