import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ExplorerModuleResourcesScreen from '../../../src/components/module-system/ExplorerModuleResourcesScreen.svelte';
import { hostProps } from '../../entityRender';
import { modulePreview } from '../../../tests/e2e/support/component-previews/modules';
import { measureWorkload } from '../../../../../test/support/measureWorkload';

test('module code catalog lists generated resources and their owning module', async () => {
	const props = modulePreview(hostProps('commit'));
	props.route = { ...props.route, screen: 'module-resources', entity: 'email.email' };
	const html = await measureWorkload(
		'reports.component.module-system-explorer-module-resources-screen',
		'render-email-resources',
		() => render(ExplorerModuleResourcesScreen, { props }).body
	);
	expect(html).toContain('Emails');
	expect(html).toContain('Welcome');
	expect(html).toContain('harness module generate email email');
	expect(html).toContain('src/mailers/email/WelcomeMailer.ts');
});
