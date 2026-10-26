import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ProjectAgent from '../../src/components/ProjectAgent.svelte';
import type { Workspace } from '../../src/lib/stores/workspace.svelte';

const drawn = (change: object = {}, open = false) => {
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
	return render(ProjectAgent, { props: { workspace: workspace as unknown as Workspace, open } }).body;
};

test('a writable catalog offers the agent as one closed control, and no form', () => {
	const body = drawn();
	expect(body).toMatch(/<button[^>]*aria-label="Work with agent"[^>]*aria-expanded="false"/s);
	expect(body).not.toMatch(/aria-label="Project agent"|<form|<textarea|<input/);
});

test.each([
	['a hosted project', { capabilities: { agents: false } }, 'Open project chat'],
	['a past commit', { pinned: true }, 'Open project chat'],
	['a view that cannot be written', { snapshot: { writable: false } }, 'Open project chat'],
	['a project without an identity', { projectId: null }, 'Open project chat'],
	['an entity that is open', { entity: { id: 'page.orders' } }, 'Work with agent']
])('%s still exposes the appropriate closed project chat bubble', (_name, change, label) => {
	expect(drawn(change)).toContain(`aria-label="${label}"`);
	expect(drawn(change)).not.toMatch(/<textarea|<form/);
});


test('an open project panel offers Chat and Work with honest unavailable feature tasks', () => {
	const body = drawn({}, true);
	const attribute = (tag: string, name: string) =>
		tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
	const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
	const tabs = [...body.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
		.map(([button]) => ({ tag: button.slice(0, button.indexOf('>') + 1), text: text(button) }))
		.filter(({ tag }) => attribute(tag, 'role') === 'tab');
	expect(body).toMatch(/aria-expanded="true"/);
	expect(body).toMatch(/role="tablist"/);
	expect(tabs.map((tab) => tab.text)).toEqual(['Chat', 'Work']);
	const panelIds = tabs.map(({ tag }) => attribute(tag, 'aria-controls'));
	const tabIds = tabs.map(({ tag }) => attribute(tag, 'id'));
	expect(new Set(panelIds).size).toBe(2);
	expect(new Set(tabIds).size).toBe(2);
	const panels = [...body.matchAll(/<[^/!][^>]*\brole="tabpanel"[^>]*>/g)].map(([tag]) => tag);
	for (const [index, tab] of tabs.entries()) {
		expect(tabIds[index]).toBeTruthy();
		expect(panelIds[index]).toBeTruthy();
		const panel = panels.find((tag) => attribute(tag, 'id') === panelIds[index]);
		expect(panel, `${tab.text} must control its own panel`).toBeDefined();
		expect(attribute(panel!, 'aria-labelledby')).toBe(tabIds[index]);
		expect(attribute(tab.tag, 'aria-selected')).toBe(index === 0 ? 'true' : 'false');
	}
	const copy = text(body);
	expect(copy).toMatch(/feature (?:tasks|work)[^.]*?(?:unavailable|not (?:yet )?(?:available|connected))/i);
	expect(copy).not.toMatch(/\b\d+\s+(?:tasks?|features?)\b|\b\d+%|\b(?:all tasks complete|no tasks remaining)\b/i);
});
