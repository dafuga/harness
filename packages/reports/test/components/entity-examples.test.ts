import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityExamples from '../../src/components/EntityExamples.svelte';

const draw = (examples: unknown[]) =>
	render(EntityExamples, {
		props: {
			documentation: { path: 'README.md', text: '# Committed <tag>', examples: examples as never }
		}
	}).body;

test('authored examples are expected outcomes, including errors and empty values', () => {
	const body = draw([
		{ name: 'Normal <tag>', input: false, output: 0 },
		{ name: 'Expected failure', input: null, error: '' }
	]);
	expect(body).toContain('// throws');
	expect(body).not.toContain('<table');
	expect(body).not.toContain('<details');
	expect(body).not.toContain('Observed output');
	expect(body).not.toContain('<tag>');
	expect(body).not.toContain('Committed document');
	expect(body).not.toContain('README.md');
});

test('an empty document states a gap instead of fabricating a use', () => {
	const body = draw([]);
	expect(body).toContain('No usage examples are documented at this commit.');
	expect(body).not.toContain('<table');
});
