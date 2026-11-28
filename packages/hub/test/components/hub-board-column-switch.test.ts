import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HubBoardColumnSwitch from '../../../reports/src/components/projects-sessions/hub-home/HubBoardColumnSwitch.svelte';
import type {
	BoardColumnId,
	BoardSwitchColumn
} from '../../../reports/src/components/projects-sessions/hub-home/hubBoardColumnSwitch.types';

const columns: BoardSwitchColumn[] = [
	{ id: 'todo', label: 'To do', count: 7 },
	{ id: 'active', label: 'In progress', count: 5 },
	{ id: 'blocked', label: 'Blocked', count: 4, needsYou: 3 },
	{ id: 'done', label: 'Done', count: 12 }
];

function renderSwitch(selected: BoardColumnId): string {
	return render(HubBoardColumnSwitch, {
		props: { columns, selected, onselect: () => undefined }
	}).body;
}

function tabSegments(body: string): string[] {
	return body.split('<button').slice(1);
}

test('renders a labelled tablist with four tabs in board order', () => {
	const body = renderSwitch('active');

	expect(body).toContain('role="tablist"');
	expect(body).toContain('aria-label="Board column"');
	const tabs = tabSegments(body);
	expect(tabs).toHaveLength(4);
	expect(tabs.every((tab) => tab.includes('role="tab"'))).toBe(true);
	expect(tabs.map((tab) => tab.match(/id="hs-tab-(\w+)"/)?.[1])).toEqual([
		'todo',
		'active',
		'blocked',
		'done'
	]);
});

test('marks only the selected tab as selected and focusable (In progress)', () => {
	const tabs = tabSegments(renderSwitch('active'));

	expect(tabs[0]).toContain('aria-selected="false"');
	expect(tabs[0]).toContain('tabindex="-1"');
	expect(tabs[1]).toContain('aria-selected="true"');
	expect(tabs[1]).toContain('tabindex="0"');
	expect(tabs[2]).toContain('aria-selected="false"');
	expect(tabs[2]).toContain('tabindex="-1"');
	expect(tabs[3]).toContain('aria-selected="false"');
	expect(tabs[3]).toContain('tabindex="-1"');
});

test('moves the selected marker when a different column is shown (Done)', () => {
	const tabs = tabSegments(renderSwitch('done'));

	expect(tabs.filter((tab) => tab.includes('aria-selected="true"'))).toHaveLength(1);
	expect(tabs[3]).toContain('aria-selected="true"');
	expect(tabs[3]).toContain('tabindex="0"');
	expect(tabs[0]).toContain('aria-selected="false"');
	expect(tabs[0]).toContain('tabindex="-1"');
});

test('renders each column label and count', () => {
	const body = renderSwitch('todo');

	expect(body).toContain('class="hs-label">To do</span>');
	expect(body).toContain('class="hs-label">In progress</span>');
	expect(body).toContain('class="hs-label">Blocked</span>');
	expect(body).toContain('class="hs-label">Done</span>');
	expect(body).toMatch(/hs-count[^>]*>7</);
	expect(body).toMatch(/hs-count[^>]*>5</);
	expect(body).toMatch(/hs-count[^>]*>4</);
	expect(body).toMatch(/hs-count[^>]*>12</);
});

test('shows the needs-you mark only on the column that has cards needing Daniel', () => {
	const body = renderSwitch('todo');
	const tabs = tabSegments(body);

	expect(body.match(/hs-needs-mark/g)).toHaveLength(1);
	expect(tabs[0]).not.toContain('hs-needs-mark');
	expect(tabs[1]).not.toContain('hs-needs-mark');
	expect(tabs[2]).toContain('hs-needs-mark');
	expect(tabs[3]).not.toContain('hs-needs-mark');
});

test('labels tabs with their count and needs-you total', () => {
	const body = renderSwitch('todo');

	expect(body).toContain('aria-label="Blocked, 4, 3 need you"');
	expect(body).toContain('aria-label="Done, 12"');
	expect(body).toContain('aria-label="To do, 7"');
});
