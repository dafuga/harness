import { expect } from '../../../test/verificationExpect';
import { afterEach, test } from 'vitest';
import { rm } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { createPlanning } from '../../planning/src/lib/planning/index';
import type { RunEvent, RunRequest } from '../src/models/DesktopBridge.types';
import { DesktopRunService } from '../src/services/agents-providers/desktop-run-service/DesktopRunService';
import { ProjectSessionService } from '../src/services/projects-sessions/project-session-service/ProjectSessionService';
import { ProviderDiscoveryService } from '../src/services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import {
	fixtureImage,
	fixtureProviders,
	remoteFixtureProject
} from '../scripts/remote-fixture-project';
import { localFixture } from './local-transport-fixture';
import { remoteFixture } from './remote-fixture';
import { bytes } from './run-fixture';

/**
 * A phone, a desktop window and the native fixture send the same default Plan over their
 * normal transports. Each option binds the four viewport captures in the real planning storage.
 */
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
/** The stored versions of a unit, with the bytes of the images of its latest version. */
async function stored(root: string, unitId: string) {
	const api = await createPlanning(root);
	const plan = await api.readPlan({ unitId });
	const latest = plan.versions.at(-1)!;
	const read = (file: string) => api.readImage({ unitId, version: latest.version, file });
	const images = await Promise.all(
		latest.images.map(async (image) => (await read(image.file)).bytes)
	);
	return { api, plan, images: images.map((image) => Buffer.from(image)) };
}
const size = (png: Buffer) => {
	const { width, height } = PNG.sync.read(png);
	return [width, height];
};
const distinct = (images: Buffer[]) =>
	new Set(images.map((image) => image.toString('base64'))).size;

function matrix(plan: Awaited<ReturnType<typeof stored>>['plan']) {
	return plan.versions.at(-1)?.images.map((image) => image.viewport);
}
const widths = ['width-390', 'width-834', 'width-1440', 'width-1920'];
const expected = [...widths, ...widths, ...widths];
const pixels = (bytes: Uint8Array) => PNG.sync.read(Buffer.from(bytes)).data;
// Saving all twelve mockup captures can take longer under macOS background scheduling.
const mockupTimeout = 75000;

test('remote: a phone starts a Plan stating no count over the wire; it finishes with three responsive mockups', async () => {
	const r = await remoteFixture();
	const phone = await r.device().connect();
	const seen: RunEvent[] = [];
	phone.client.on('run', (event) => seen.push(event as RunEvent));
	const request = r.start();
	expect(request).not.toHaveProperty('designOptions');
	await phone.client.request<{ runId: string }>('startRun', request);
	await expect.poll(() => seen.at(-1)?.kind, { timeout: mockupTimeout }).toBe('finished');
	const { plan, images } = await stored(r.root, r.request.entityId);
	expect(plan.versions.map((version) => version.options?.length)).toEqual([3]);
	expect(matrix(plan)).toEqual(expected);
	expect([images.map(size), distinct(images)]).toEqual([
		Array.from({ length: 12 }, () => [2, 2]),
		12
	]);
	expect(pixels(images[0])).toEqual(pixels(bytes));
}, 180000);

test('local: a window opens its project and starts a Plan stating no count; it finishes with three responsive mockups', async () => {
	const l = await localFixture();
	const window = l.connect(l.window());
	const seen: RunEvent[] = [];
	window.on('run', (event) => seen.push(event as RunEvent));
	await window.request('openProject');
	expect(l.request).not.toHaveProperty('designOptions');
	await window.request('startRun', l.request);
	await expect.poll(() => seen.at(-1)?.kind, { timeout: mockupTimeout }).toBe('finished');
	const { plan, images } = await stored(l.root, l.request.entityId);
	expect(plan.versions.map((version) => version.options?.length)).toEqual([3]);
	expect(matrix(plan)).toEqual(expected);
	expect([images.map(size), distinct(images)]).toEqual([
		Array.from({ length: 12 }, () => [2, 2]),
		12
	]);
	expect(pixels(images[0])).toEqual(pixels(bytes));
}, 180000);

test('native: the fixture project plans with its stand-in providers, stating no count; it finishes with three responsive mockups', async () => {
	const { root, entityId, threadId } = await remoteFixtureProject();
	roots.push(root);
	const session = new ProjectSessionService();
	await session.open(root);
	const { renderMockups, ...runners } = fixtureProviders();
	const events: RunEvent[] = [];
	const runs = new DesktopRunService(
		session,
		new ProviderDiscoveryService(runners),
		(event) => events.push(event),
		renderMockups
	);
	await runs.start({
		...{ mode: 'plan', provider: 'codex', model: 'fixture-model', effort: 'high' },
		...{ entityId, threadId, text: 'Design the fixture page', approval: null }
	} as RunRequest);
	await expect.poll(() => session.busy, { timeout: mockupTimeout }).toBe(false);
	expect(events.at(-1)).toMatchObject({ kind: 'finished' });
	const { api, plan, images } = await stored(root, entityId);
	expect(plan.versions.map((version) => version.options?.length)).toEqual([undefined, 3]);
	expect(matrix(plan)).toEqual(expected);
	expect([images.map(size), distinct(images)]).toEqual([
		Array.from({ length: 12 }, () => [128, 128]),
		12
	]);
	expect(pixels(images[0])).toEqual(pixels(fixtureImage(128)));
	// The seeded single design is the picture it always was.
	const [seed] = plan.versions[0].images;
	const seeded = await api.readImage({ unitId: entityId, version: 'v001', file: seed.file });
	expect(Buffer.from(seeded.bytes).equals(Buffer.from(fixtureImage()))).toBe(true);
}, 180000);
