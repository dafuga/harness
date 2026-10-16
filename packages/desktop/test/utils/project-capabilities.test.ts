import { expect, test, vi } from 'vitest';
import { closedCapabilities, projectCapabilities } from '../../src/utils/projectCapabilities';
import type { DesktopBridge } from '../../src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';
import type { ProjectCapabilities } from '../../src/models/ProjectContext.types';

const stated: ProjectCapabilities = {
	comments: true,
	agents: false,
	planning: false,
	approval: false,
	source: 'github'
};
const snapshot = (capabilities?: ProjectCapabilities, id?: string) =>
	({ project: { name: 'p', root: '', id }, capabilities }) as ProjectSnapshot;
const bridge = (value: object) => value as unknown as DesktopBridge;

test('what the snapshot states is used, and commenting needs the comment operation', async () => {
	const addComment = vi.fn();
	expect(await projectCapabilities(bridge({ addComment }), snapshot(stated, 'p'))).toEqual(stated);
	expect(await projectCapabilities(bridge({}), snapshot(stated, 'p'))).toEqual({
		...stated,
		comments: false
	});
});

test('a snapshot that states nothing asks the bridge for its own project', async () => {
	const capabilities = vi.fn(async () => stated);
	const value = await projectCapabilities(
		bridge({ capabilities, addComment: vi.fn() }),
		snapshot(undefined, 'p')
	);
	expect(capabilities).toHaveBeenCalledWith({ projectId: 'p' });
	expect(value).toEqual(stated);
});

test('a bridge from before capabilities keeps its agent workflow and gains no comments', async () => {
	expect(await projectCapabilities(bridge({}), snapshot())).toEqual({
		comments: false,
		agents: true,
		planning: true,
		approval: true,
		source: 'local'
	});
});

test('capabilities that cannot be read allow nothing', async () => {
	const capabilities = vi.fn(async () => {
		throw new Error('offline');
	});
	const value = await projectCapabilities(
		bridge({ capabilities, addComment: vi.fn() }),
		snapshot(undefined, 'p')
	);
	expect(value).toMatchObject(closedCapabilities);
	expect(value.reason).toBeTruthy();
});
