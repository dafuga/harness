import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { expect, test, vi } from 'vitest';
import type { ModuleData } from '../../../../../src/services/git-source-history/ModuleDataService.types';
import type { GeneratedPage, PreparationPageDesign } from '../../../../../src/services/agents-providers/FeaturePlanPreparationService.types';
import type { DesignDraft, PlanRecord } from '../../../src/models/planning-collaboration/PlanningPort.types';
import type { DesignVersion } from '../../../src/models/development-tooling/Desktop.types';
import type { ImageRequest } from '../../../src/models/agents-providers/AgentRunner.types';
import { FeaturePlanPreparationHostService } from '../../../src/services/agents-providers/FeaturePlanPreparationHostService';

const commit = 'a'.repeat(40),
	commitAfter = 'b'.repeat(40),
image = (shade: number) => {
	const png = new PNG({ width: 2, height: 2 });
	for (let i = 0; i < png.data.length; i += 4) {
		png.data[i] = shade;
		png.data[i + 1] = 40;
		png.data[i + 2] = 80;
		png.data[i + 3] = 255;
	}
	return new Uint8Array(PNG.sync.write(png));
},
hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex'),
referenceBytes = image(10),
referenceHash = hash(referenceBytes);

type PageInput = Parameters<FeaturePlanPreparationHostService['preparePage']>[0];
type FinalizeInput = Parameters<FeaturePlanPreparationHostService['finalize']>[0];

function design(): PreparationPageDesign {
	return {
		module: 'pages.home',
		reference: {
			kind: 'current', entityId: 'pages.home', commit, version: 'v001', state: 'default',
			viewport: 'desktop', file: 'o1-default-desktop.png', sha256: referenceHash, option: 'o1'
		},
		region: { x: 0.7, y: 0, width: 0.3, height: 1 },
		options: [
			{ id: 'o1', preferred: true, direction: 'compact', instruction: 'Keep the right panel compact.' },
			{ id: 'o2', preferred: false, direction: 'spacious', instruction: 'Use more panel whitespace.' },
			{ id: 'o3', preferred: false, direction: 'high contrast', instruction: 'Increase panel contrast.' }
		]
	};
}

function pageInput(bytes = referenceBytes): PageInput {
	return {
		module: 'pages.home', moduleGoal: 'Keep project navigation clear.', options: design().options,
		sourceCommit: commit, count: 3, goal: 'Improve project work.', tldr: 'Review then build.',
		originalRequest: 'Change only the right panel.', reference: design().reference, region: design().region,
		imagePrompt: 'Overall goal: Improve project work.\nFeature TLDR: Review then build.\nUser request: Change only the right panel.\nEdit only the right panel. Preserve everything outside it.',
		signal: new AbortController().signal, referenceBytes: bytes
	};
}

function sourceVersion(): DesignVersion {
	return {
		version: 'v001', createdAt: '2026-01-01T00:00:00.000Z', commit, generator: 'codex · legacy',
		prompt: 'existing', baseRevision: commit, approval: null,
		images: [{ file: 'o1-default-desktop.png', state: 'default', viewport: 'desktop', sha256: referenceHash, bytes: referenceBytes.length, option: 'o1' }],
		options: [{ id: 'o1', direction: 'existing', prompt: 'existing', revisedPrompt: null, generator: 'codex · legacy', imageHashes: [referenceHash] }]
	};
}

function sourcePlan(): PlanRecord {
	return {
		id: 'pages.home', path: 'pages/home', category: 'pages', title: 'Home', goal: 'Home page',
		lifecycle: 'review', contract: {}, versions: [sourceVersion()], threads: []
	} as unknown as PlanRecord;
}

function setup() {
	let head = commit, record = sourcePlan();
	const planning = {
		plans: vi.fn(async () => [record]),
		addDesign: vi.fn(async (draft: DesignDraft) => {
			const options = draft.options ?? [], images = options.map((option, index) => ({
				file: `o${index + 1}-default-desktop.png`, state: draft.state, viewport: draft.viewport,
				sha256: hash(option.bytes), bytes: option.bytes.length, option: `o${index + 1}`
			}));
			const version: DesignVersion = {
				version: 'v002', createdAt: '2026-01-01T00:00:01.000Z', commit: commitAfter,
				generator: 'codex · gpt-image-2.5-sunburst', prompt: draft.prompt, baseRevision: draft.baseRevision,
				approval: null, images,
				options: options.map((option, index) => ({
					id: `o${index + 1}`, direction: option.direction, prompt: option.prompt,
					revisedPrompt: option.revisedPrompt, generator: 'codex · gpt-image-2.5-sunburst',
					imageHashes: [images[index]!.sha256]
				}))
			};
			head = commitAfter;
			record = { ...record, versions: [...record.versions, version] };
			return version;
		})
	};
	const service = new FeaturePlanPreparationHostService({
		generator: { generateImage: vi.fn(async () => ({ bytes: image(90), revisedPrompt: 'reported prompt' })) },
		planning,
		revision: async () => head,
		data: async (value) => ({ commit: value }) as ModuleData
	});
	return { service, planning, head: () => head };
}

function generated(): GeneratedPage {
	return {
		module: 'pages.home',
		options: design().options.map((option, index) => ({
			...option, prompt: `prompt ${index + 1}`, revisedPrompt: null, bytes: image(index + 20)
		}))
	};
}

function finalizeInput(): FinalizeInput {
	return { sourceCommit: commit, pages: [generated()], designs: [design()] };
}

test('preparePage uses the exact reference and refuses invalid inputs', async () => {
	const calls: Array<{ reference: string | null; cwd: string; prompt: string; model: string }> = [];
	const generator = vi.fn(async (request: ImageRequest) => {
		calls.push(request);
		expect(request.reference).toBeTruthy();
		expect(new Uint8Array(await readFile(request.reference!))).toEqual(referenceBytes);
		return { bytes: image(40 + calls.length), revisedPrompt: `revised ${calls.length}` };
	});
	const service = new FeaturePlanPreparationHostService({
		generator: { generateImage: generator },
		planning: { plans: vi.fn(async () => [sourcePlan()]), addDesign: vi.fn() } as never,
		revision: async () => commit,
		data: async (value) => ({ commit: value }) as ModuleData
	}), page = await service.preparePage(pageInput());
	expect(page.options).toHaveLength(3);
	expect(page.options.map((option) => option.id)).toEqual(['o1', 'o2', 'o3']);
	expect(calls.map((call) => call.model)).toEqual(Array(3).fill('gpt-image-2.5-sunburst'));
	expect(calls[0]?.prompt.startsWith('Overall goal: Improve project work.')).toBe(true);
	expect(calls[0]?.prompt).toContain('Preserve everything outside it.');
	expect(calls[0]?.prompt).toContain('User request: Change only the right panel.');
	await expect(access(calls[0]!.cwd)).rejects.toThrow();
	expect(generator).toHaveBeenCalledTimes(3);
	await expect(service.preparePage(pageInput(image(99)))).rejects.toThrow('Committed reference hash mismatch');
	expect(generator).toHaveBeenCalledTimes(3);
	const incomplete = pageInput();
	incomplete.options.pop();
	await expect(service.preparePage(incomplete)).rejects.toThrow('Three distinct options');
	const aborted = pageInput(), controller = new AbortController();
	controller.abort();
	aborted.signal = controller.signal;
	await expect(service.preparePage(aborted)).rejects.toThrow();
	expect(generator).toHaveBeenCalledTimes(3);
	const invalidGenerator = vi.fn(async () => ({ bytes: new Uint8Array([1, 2, 3]), revisedPrompt: null })),
		invalidPage = new FeaturePlanPreparationHostService({
			generator: { generateImage: invalidGenerator },
			planning: { plans: vi.fn(async () => [sourcePlan()]), addDesign: vi.fn() } as never,
			revision: async () => commit,
			data: async (value) => ({ commit: value }) as ModuleData
		});
	await expect(invalidPage.preparePage(pageInput())).rejects.toThrow();
	expect(invalidGenerator).toHaveBeenCalledTimes(1);
});

test('finalize writes exact image references and refuses stale designs before writing', async () => {
	const { service, planning, head } = setup();
	const result = await service.finalize(finalizeInput(), new AbortController().signal);
	const draft = planning.addDesign.mock.calls[0]![0];
	expect(draft.expectedLatest).toBe('v001');
	expect(draft.baseRevision).toBe(commit);
	expect(draft.revises).toMatchObject({ version: 'v001', imageSha256: referenceHash, option: 'o1' });
	expect(result.sourceCommit).toBe(commitAfter);
	expect(result.data.commit).toBe(commitAfter);
	expect(head()).toBe(commitAfter);
	expect(result.pages[0]).toMatchObject({
		module: 'pages.home',
		options: [
			{ id: 'o1', preferred: true, commit: commitAfter, path: 'pages/home/designs/v002/o1-default-desktop.png' },
			{ id: 'o2', preferred: false },
			{ id: 'o3', preferred: false }
		]
	});
	const stale = setup();
	const staleService = new FeaturePlanPreparationHostService({
		generator: { generateImage: vi.fn() }, planning: stale.planning,
		revision: async () => commitAfter, data: async (value) => ({ commit: value }) as ModuleData
	});
	await expect(staleService.finalize(finalizeInput(), new AbortController().signal)).rejects.toThrow('Source revision changed');
	expect(stale.planning.addDesign).not.toHaveBeenCalled();
	const missingAnchor = setup();
	missingAnchor.planning.plans.mockResolvedValue([{
		id: 'pages.home', path: 'pages/home', category: 'pages', title: 'Home', goal: 'Home page',
		lifecycle: 'review', contract: {}, versions: [], threads: []
	} as unknown as PlanRecord]);
	await expect(missingAnchor.service.finalize(finalizeInput(), new AbortController().signal)).rejects.toThrow('Committed design reference changed');
	expect(missingAnchor.planning.addDesign).not.toHaveBeenCalled();
	const invalidSecondPage = setup(), second = generated();
	second.module = 'pages.missing';
	const twoPageInput = finalizeInput();
	twoPageInput.pages.push(second);
	const secondDesign = design();
	secondDesign.module = 'pages.missing';
	secondDesign.reference.entityId = 'pages.missing';
	twoPageInput.designs.push(secondDesign);
	await expect(invalidSecondPage.service.finalize(twoPageInput, new AbortController().signal)).rejects.toThrow('Missing exact reference plan');
	expect(invalidSecondPage.planning.addDesign).not.toHaveBeenCalled();
	const cancelled = setup(), controller = new AbortController();
	controller.abort();
	await expect(cancelled.service.finalize(finalizeInput(), controller.signal)).rejects.toThrow();
	expect(cancelled.planning.addDesign).not.toHaveBeenCalled();
});
