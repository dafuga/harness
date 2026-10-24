import { expect, test } from 'vitest';
import { content, hostProps } from '../../entityRender';
import { withGroups } from '../../entityPreviewData';

// SSR must render useful, expanded groups before hydration, with distinct control targets.
test('catalog groups render named expanded controls and unique content targets', () => {
	for (const category of [
		'pages',
		'layouts',
		'components',
		'functions',
		'configs',
		'services',
		'models',
		'types'
	] as const) {
		const markup = content('commit', { category }, { head: withGroups(hostProps('commit').head) });
		const controls = [
			...markup.matchAll(/<button\b[^>]*aria-expanded="true"[^>]*aria-controls="([^"]+)"/g)
		];
		expect(controls.length, category).toBeGreaterThan(0);
		const targets = controls.map((match) => match[1]);
		expect(new Set(targets).size, category).toBe(targets.length);
		for (const target of targets) expect(markup).toContain(`id="${target}"`);
	}
});
