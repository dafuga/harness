import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { imageSha, projectFixture, tip } from './ui-project-fixture';
export * from './ui-project-fixture';

/**
 * Three SYNTHETIC design options of one version. Each is its own PNG with its own colour and
 * stripe, so the bytes, the hashes and the pixels of the three all differ. No image was generated.
 */
export const colors = { o1: [200, 40, 40], o2: [40, 160, 60], o3: [40, 70, 200] } as const;
export type OptionId = keyof typeof colors;
export const optionThread = '44444444-4444-4444-8444-444444444444';
function png(color: readonly number[], stripe: number) {
	const image = new PNG({ width: 96, height: 64 });
	for (let y = 0; y < 64; y++)
		for (let x = 0; x < 96; x++) {
			const band = x >= stripe && x < stripe + 8;
			image.data.set(band ? [250, 250, 250, 255] : [...color, 255], (y * 96 + x) * 4);
		}
	return PNG.sync.write(image);
}
export const options = (Object.keys(colors) as OptionId[]).map((id, index) => {
	const bytes = png(colors[id], 8 + index * 24);
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	return { id, sha256, bytes: Array.from(bytes), direction: `Synthetic direction ${index + 1}` };
});
export const sha = (id: OptionId) => options.find((option) => option.id === id)!.sha256;

type Item = Record<string, unknown>;
interface Entity extends Item {
	id: string;
	versions: Item[];
	threads: Item[];
}
interface Host {
	harness: Record<string, unknown>;
	__emitRun: (event: Item) => void;
	__projects: {
		data: {
			image: number[];
			projects: Array<{ entities: Entity[]; messages: Record<string, Item[]> }>;
		};
		own: (op: string, input?: Item) => { entities: Entity[] };
	};
}
interface Seed {
	options: typeof options;
	tip: string;
	legacy: string;
	thread: string;
}

/** Alpha (local) and Gamma (shared) gain v003 with three options; v002 stays one design. */
function installOptions(seed: Seed) {
	const { data } = (window as unknown as Host).__projects;
	const image = (option: Seed['options'][number]) => ({
		...{ state: 'default', viewport: 'desktop', sha256: option.sha256 },
		...{ bytes: option.bytes.length, option: option.id }
	});
	const version = {
		...{ version: 'v003', createdAt: '2026-10-14', commit: seed.tip, generator: 'GPT Image' },
		...{ prompt: 'Synthetic activity options', baseRevision: seed.tip, approval: null },
		images: seed.options.map(image),
		// The public DesignOptionInfo: its images are the flat images that name it, by hash.
		options: seed.options.map((option, index) => ({
			...{ id: option.id, direction: option.direction, generator: 'GPT Image' },
			...{ prompt: `Synthetic option prompt ${index + 1}`, revisedPrompt: null },
			imageHashes: [option.sha256]
		}))
	};
	for (const project of [data.projects[0], data.projects[2]]) {
		const page = project.entities[0];
		page.versions.push(structuredClone(version));
		page.latestVersion = 'v003';
		page.thumbnail = { version: 'v003', ...image(seed.options[0]) };
	}
}

/** A thread on option 2, a component of one legacy design and a headless function in Alpha. */
function installEntities(seed: Seed) {
	const { data } = (window as unknown as Host).__projects;
	const alpha = data.projects[0];
	const [page, button] = alpha.entities;
	const anchor = { version: 'v003', imageSha256: seed.options[1].sha256, option: 'o2' };
	page.threads.push({
		...{ id: seed.thread, pin: 3, state: 'default', viewport: 'desktop', messageCount: 1 },
		...{ ...anchor, region: { x: 0.5, y: 0.3, width: 0.2, height: 0.2 } }
	});
	alpha.messages[seed.thread] = [
		{
			...{ id: 'option-message', at: 'Today', author: 'user', mode: 'plan', provider: 'codex' },
			...{ text: 'Option 2: keep the green header.', model: 'fixture', ...anchor }
		}
	];
	const legacy = { state: 'default', viewport: 'desktop', sha256: seed.legacy };
	button.versions = [
		{
			...{ version: 'v001', createdAt: '2026-10-10', commit: seed.tip, generator: 'GPT Image' },
			...{ prompt: 'Legacy button', baseRevision: seed.tip, approval: null },
			images: [{ ...legacy, bytes: data.image.length }]
		}
	];
	Object.assign(button, { latestVersion: 'v001', thumbnail: { version: 'v001', ...legacy } });
	alpha.entities.push({
		...structuredClone(button),
		...{ id: 'function:format-time', category: 'functions', kind: 'function' },
		...{ title: 'Format time', versions: [], threads: [], latestVersion: null, thumbnail: null }
	});
}

/** Option images by hash, approvals of what was sent, and runs answered only by test events. */
function installBridge(seed: Seed) {
	const host = window as unknown as Host;
	const state = host.__projects;
	const listeners = new Set<(event: Item) => void>();
	Object.assign(host.harness, {
		image: async (input: Item) => {
			state.own('image', input);
			const found = seed.options.find((option) => option.sha256 === input.sha256);
			return new Uint8Array(found ? found.bytes : state.data.image);
		},
		approve: async (input: Item) => {
			const page = state.own('approve', input).entities.find((item) => item.id === input.entityId);
			const version = page?.versions.find((item) => item.version === input.version);
			if (!page || !version) throw new Error('Unknown version.');
			const { projectId: _projectId, entityId: _entityId, ...bound } = input;
			version.approval = { ...bound, id: 'approval-1', approvedAt: '2026-10-14', current: true };
			page.approvedVersion = input.version;
			return version.approval;
		},
		startRun: async (input: Item) => {
			state.own('startRun', input);
			return { runId: 'options-run' };
		},
		onRunEvent: (listener: (event: Item) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	});
	host.__emitRun = (event) =>
		listeners.forEach((listen) => listen({ runId: 'options-run', ...event }));
}

/** The project fixture, local or shared, whose activity page has three synthetic options. */
export async function designOptionsFixture(
	page: Page,
	base: (page: Page) => Promise<unknown> = projectFixture
) {
	await base(page);
	const seed: Seed = { options, tip, legacy: imageSha, thread: optionThread };
	await page.addInitScript(installOptions, seed);
	await page.addInitScript(installEntities, seed);
	await page.addInitScript(installBridge, seed);
}
