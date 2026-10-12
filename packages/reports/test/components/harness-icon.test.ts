import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HarnessIcon from '../../src/components/harness/HarnessIcon.svelte';
import { harnessIcons, type HarnessIconName } from '../../src/utils/harnessIcons';

const markup = (props: { name: HarnessIconName; size?: number; label?: string }) =>
	render(HarnessIcon, { props }).body;
const tag = (body: string) => body.match(/<svg\b[^>]*>/)?.[0] ?? '';

test('an icon beside words is decoration: one svg of the asked size that is not read out', () => {
	const body = markup({ name: 'functions' });
	expect(body.match(/<svg\b/g)).toHaveLength(1);
	expect(tag(body)).toContain('viewBox="0 0 24 24"');
	expect(tag(body)).toContain('aria-hidden="true"');
	expect(tag(body)).toContain('focusable="false"');
	expect(tag(body)).toMatch(/width="20"[^>]*height="20"/);
	expect(tag(body)).not.toContain('role=');
	expect(tag(markup({ name: 'functions', size: 24 }))).toMatch(/width="24"[^>]*height="24"/);
	expect(body).toContain(`d="${harnessIcons.functions}"`);
});

test('an icon that stands alone is an image with a name', () => {
	const named = tag(markup({ name: 'help', label: 'What this measures' }));
	expect(named).toContain('role="img"');
	expect(named).toContain('aria-label="What this measures"');
	expect(named).not.toContain('aria-hidden');
});

test('every name draws its own path, outlined except for the two verdict discs', () => {
	for (const name of Object.keys(harnessIcons) as HarnessIconName[]) {
		const body = markup({ name });
		expect([name, body.includes(`d="${harnessIcons[name]}"`)]).toEqual([name, true]);
		const solid = /class="[^"]*\bsolid\b/.test(tag(body));
		expect([name, solid]).toEqual([name, name === 'passed' || name === 'failed']);
	}
});
