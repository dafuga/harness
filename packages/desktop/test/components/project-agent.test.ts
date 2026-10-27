import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import ProjectAgent from '../../src/components/ProjectAgent.svelte';
import ProjectWork from '../../src/components/agents-providers/ProjectWork.svelte';
import type { FeatureWorkSnapshot } from '../../../../src/services/agents-providers/FeatureWorkService.types';
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
	return render(ProjectAgent, { props: { workspace: workspace as unknown as Workspace, open } })
		.body;
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
	const text = (html: string) =>
		html
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	const tabs = [...body.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
		.map(([button]) => ({ tag: button.slice(0, button.indexOf('>') + 1), text: text(button) }))
		.filter(({ tag }) => attribute(tag, 'role') === 'tab');
	expect(body).toMatch(/aria-expanded="true"/);
	expect(body).toMatch(/role="tablist"/);
	expect(tabs.map((tab) => tab.text)).toEqual(['Chat', 'Work', 'Agents']);
	const panelIds = tabs.map(({ tag }) => attribute(tag, 'aria-controls'));
	const tabIds = tabs.map(({ tag }) => attribute(tag, 'id'));
	expect(new Set(panelIds).size).toBe(3);
	expect(new Set(tabIds).size).toBe(3);
	const panels = [...body.matchAll(/<[^/!][^>]*\brole="tabpanel"[^>]*>/g)].map(([tag]) => tag);
	expect(panels).toHaveLength(3);
	for (const [index, tab] of tabs.entries()) {
		expect(tabIds[index]).toBeTruthy();
		expect(panelIds[index]).toBeTruthy();
		const panel = panels.find((tag) => attribute(tag, 'id') === panelIds[index]);
		expect(panel, `${tab.text} must control its own panel`).toBeDefined();
		expect(attribute(panel!, 'aria-labelledby')).toBe(tabIds[index]);
		expect(attribute(tab.tag, 'aria-selected')).toBe(index === 0 ? 'true' : 'false');
	}
	const copy = text(body);
	expect(copy).toMatch(
		/feature (?:tasks|work)[^.]*?(?:unavailable|not (?:yet )?(?:available|connected))/i
	);
	expect(copy).not.toMatch(
		/\b\d+\s+(?:tasks?|features?)\b|\b\d+%|\b(?:all tasks complete|no tasks remaining)\b/i
	);
});

const workText = (
	snapshot: FeatureWorkSnapshot | null,
	loading = false,
	error: string | null = null
) => {
	const workspace = { projectId: 'local-1', bridge: null } as unknown as Workspace,
		actions = { pending: false, error: null, select: async () => true, approve: async () => true };
	return render(ProjectWork, { props: { snapshot, loading, error, workspace, actions } as never })
		.body.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
};

const wantedContract = {
	responsibility: 'Calculate the exact basket total',
	inputs: [{ name: 'basket', type: 'Basket' }],
	outputs: [{ name: 'total', type: 'Money' }],
	errors: []
};

function workPage() {
	return {
		module: 'page.checkout',
		selected: 'o2',
		options: [
			{
				id: 'o2',
				version: 'v002',
				commit: 'b'.repeat(40),
				path: 'design/checkout.png',
				sha256: 'd'.repeat(64),
				preferred: true
			}
		]
	};
}

function planTasks(tasks: FeatureWorkSnapshot['features'][number]['tasks']) {
	return tasks.map(({ id, title, module, dependsOn }) => ({
		id,
		title,
		module,
		moduleGoal: `Implement ${module}`,
		dependsOn,
		feature: 'checkout',
		instructions: 'Implement checkout',
		wantedContract,
		model: 'auto',
		role: 'implementation' as const
	}));
}

function workSnapshot(): FeatureWorkSnapshot {
	const statuses = ['queued', 'running', 'review', 'accepted', 'failed'] as const;
	const tasks = statuses.map((status) => ({
		id: `checkout.${status}`,
		title: `Checkout ${status} task`,
		module: `service.${status}`,
		status,
		dependsOn: status === 'queued' ? ['checkout.failed'] : [],
		blockedBy: status === 'queued' ? ['checkout.failed'] : [],
		belongsToPlan: true
	}));

	return {
		queueCommit: 'a'.repeat(40),
		features: [
			{
				id: 'checkout',
				goal: 'Make checkout reliable',
				tldr: 'Review checkout work',
				tasks,
				plan: {
					feature: 'checkout',
					sourceCommit: 'b'.repeat(40),
					revision: 2,
					goal: 'Make checkout reliable',
					tldr: 'Review checkout work',
					digest: 'c'.repeat(64),
					pages: [workPage()],
					changes: [
						{
							unit: 'page.checkout',
							kind: 'modify',
							assignedFiles: ['src/checkout.ts'],
							wantedContract
						},
						{
							unit: 'service.queued',
							parent: 'page.checkout',
							kind: 'add',
							assignedFiles: ['src/total.ts'],
							wantedContract
						}
					],
					tasks: planTasks(tasks)
				}
			}
		]
	};
}

test('feature Work distinguishes loading, unavailable and an empty committed queue', () => {
	expect(workText(null, true)).toMatch(/loading/i);
	expect(workText(null, false, 'Feature work is unavailable')).toMatch(
		/feature work is unavailable/i
	);
	const empty = workText({ queueCommit: null, features: [] });
	expect(empty).toMatch(/no (?:committed )?(?:feature|work|task)|nothing .*?(?:queued|planned)/i);
	for (const body of [
		workText(null, true),
		workText(null, false, 'Feature work is unavailable'),
		empty
	])
		expect(body).not.toMatch(/Checkout .*? task|\b\d+%|all tasks complete/i);
});

test('feature Work renders committed plan hierarchy, explicit statuses and dependency blockers', () => {
	const snapshot = workSnapshot();
	const body = workText(snapshot);
	expect(body).toContain('Make checkout reliable');
	expect(body).toContain('page.checkout');
	expect(body).toContain('service.queued');
	for (const task of snapshot.features[0].tasks) {
		expect(body).toContain(task.title);
	}
	for (const status of [/to do/i, /running|in progress/i, /review/i, /completed/i, /failed/i])
		expect(body).toMatch(status);
	expect(body).toMatch(/blocked|waiting/i);
	expect(body).toContain('checkout.failed');
	expect(body).toContain('Calculate the exact basket total');
	expect(body).toContain('o2');
	expect(body).toMatch(/preferred/i);
	expect(body).toMatch(/selected/i);
	expect(body).not.toMatch(/foreign-feature|all tasks complete|100%/i);
});
