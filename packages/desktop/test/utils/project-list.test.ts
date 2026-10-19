import { expect, test, vi } from 'vitest';
import { listedProjects } from '../../src/utils/projectList';
import { projectList } from '../../src/components/project-switcher/projectList';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';

const bridge = (value: object) => value as unknown as DesktopBridge;
const shown = (id: string | undefined, source?: 'local' | 'github') =>
	({
		project: { name: 'Shown', root: '', id },
		capabilities: source && {
			comments: true,
			agents: false,
			planning: false,
			approval: false,
			source
		}
	}) as ProjectSnapshot;

test('a bridge without a project list has none', async () => {
	expect(await listedProjects(bridge({}))).toEqual([]);
	const listProjects = vi.fn(async () => [{ id: 'a', name: 'A', kind: 'local' as const }]);
	expect(await listedProjects(bridge({ listProjects }))).toEqual([
		{ id: 'a', name: 'A', kind: 'local' }
	]);
});

test('the switcher always holds the shown project, once', () => {
	const listed = [
		{ id: 'a', name: 'A', kind: 'local' as const },
		{ id: 'b', name: 'B', kind: 'shared' as const }
	];
	expect(projectList(listed, shown('a'))).toEqual(listed);
	expect(projectList(listed, null)).toEqual(listed);
	expect(projectList(listed, shown('c', 'github')).at(-1)).toEqual({
		id: 'c',
		name: 'Shown',
		kind: 'shared'
	});
	expect(projectList([], shown(undefined))).toEqual([{ id: '', name: 'Shown', kind: 'local' }]);
});
