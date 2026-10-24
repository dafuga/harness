import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import ExplorerDependenciesScreen from '../../../src/components/explorer-ui/ExplorerDependenciesScreen.svelte';
import { host } from '../../../tests/e2e/support/component-previews/explorerData';
import { dependencyPreview } from '../../../tests/e2e/support/component-previews/dependencies';

const shown = () => dependencyPreview(host());
const html = (props = shown()) => render(ExplorerDependenciesScreen, { props }).body;

test('dependency inventory groups identical declarations but retains distinct requirements and kinds', async () => {
	const body = await measureWorkload(
		'reports.component.explorer-dependencies-screen',
		'render-package-inventory',
		() => html()
	);
	expect(body, 'Project dependencies include declarations').toContain('zod');
	expect(body).toContain('^4.0.0');
	expect(body).toContain('^3.0.0');
	expect(body).toContain('typescript');
	expect(body).toContain('serde');
	expect(body.match(/<tbody>/g)).toHaveLength(2);
	expect(body.match(/<tr>/g)).toHaveLength(6);
	expect(body).toContain('packages/api/package.json');
	expect(body).toContain('packages/web/package.json');
	expect(body).toContain('Development');
});

test('dependency inventory distinguishes missing old data, empty declarations and partial reads', () => {
	const props = shown();
	delete props.head.projectDependencies;
	expect(html(props)).toMatch(/No dependency record.*indexed/);
	props.head.projectDependencies = { entries: [], gaps: [] };
	expect(html(props)).toContain('No dependencies are declared');
	props.head.projectDependencies = { entries: [], gaps: ['package.json could not be read'] };
	expect(html(props)).toContain('package.json could not be read');
	expect(html(props)).toContain('No declarations could be read');
	props.head.projectDependencies = shown().head.projectDependencies;
	props.head.projectDependencies!.gaps = ['A workspace is unreadable'];
	expect(html(props)).toContain('A workspace is unreadable');
	expect(html(props)).toContain('zod');
});
