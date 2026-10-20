import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ProjectAgent from '../../src/components/ProjectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';

const drawn = (change: object = {}) => {
	const workspace = {
		bridge: null,
		category: 'components',
		projectId: 'local-1',
		pinned: false,
		entity: null,
		capabilities: { agents: true },
		snapshot: { writable: true },
		...change
	};
	return render(ProjectAgent, { props: { workspace: workspace as unknown as Workspace } }).body;
};

test('a writable catalog offers the agent as one closed control, and no form', () => {
	const body = drawn();
	expect(body).toMatch(/<button[^>]*aria-label="Work with agent"[^>]*aria-expanded="false"/s);
	expect(body).not.toMatch(/aria-label="Project agent"|<form|<textarea|<input/);
});

test.each([
	['a hosted project', { capabilities: { agents: false } }],
	['a past commit', { pinned: true }],
	['a view that cannot be written', { snapshot: { writable: false } }],
	['a project without an identity', { projectId: null }],
	['an entity that is open', { entity: { id: 'page.orders' } }]
])('%s still exposes the closed project chat bubble', (_name, change) => {
	expect(drawn(change)).toMatch(/<button[^>]*aria-label="(?:Work with agent|Open project chat)"/);
	expect(drawn(change)).not.toMatch(/<textarea|<form/);
});
