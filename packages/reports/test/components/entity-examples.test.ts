import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import EntityExamples from '../../src/components/EntityExamples.svelte';

const draw = (examples: unknown[], setup?: string, setupTitle?: string) =>
	render(EntityExamples, {
		props: {
			documentation: {
				path: 'README.md',
				text: '# Committed <tag>',
				examples: examples as never,
				...(setup ? { setup } : {})
			},
			...(setupTitle ? { setupTitle } : {})
		}
	}).body;
const calls = [
	{ name: 'Register an agent', call: 'await agents.register({})', input: [{}], output: null },
	{ name: 'List the agents', call: 'await agents.roster()', input: [], output: [] }
];
const create = 'const agents = new AgentActivityService(root, checkouts);';
const times = (body: string, text: string) => body.split(text).length - 1;

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

test('a titled setup leads once, before the calls that use it', () => {
	const body = draw(calls, create, 'Create the service');
	expect(times(body, 'new AgentActivityService')).toBe(1);
	expect(times(body, '<article')).toBe(3);
	expect(body.indexOf('Create the service')).toBeLessThan(body.indexOf('Register an agent'));
	expect(body.indexOf('new AgentActivityService')).toBeLessThan(body.indexOf('agents.register'));
	expect(body).not.toContain('How to create it is not documented');
	// Without a title the setup stays with each call, as function examples show it.
	const untitled = draw(calls, create);
	expect(times(untitled, 'new AgentActivityService')).toBe(2);
	expect(times(untitled, '<article')).toBe(2);
	expect(untitled).not.toContain('Create the service');
});

test('a missing construction is a gap, never a guessed instance', () => {
	const body = draw(calls, undefined, 'Create the service');
	expect(body).toContain('How to create it is not documented at this commit.');
	expect(body).not.toContain('Create the service');
	expect(times(body, '<article')).toBe(2);
	expect(draw([], undefined, 'Create the service')).not.toContain('How to create it');
});
