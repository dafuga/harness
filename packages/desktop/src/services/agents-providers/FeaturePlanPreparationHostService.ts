import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, posix } from 'node:path';
import type { FeaturePlanPage } from '../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
import type { ModuleData } from '../../../../../src/services/git-source-history/ModuleDataService.types';
import type {
	FeaturePlanPreparationDependencies,
	GeneratedPage,
	PreparationDesignReference,
	PreparationPageDesign
} from '../../../../../src/services/agents-providers/FeaturePlanPreparationService.types';
import type { ImageGenerator } from '../../models/agents-providers/AgentRunner.types';
import type { DesignVersion } from '../../models/development-tooling/Desktop.types';
import type { PlanningPort, PlanRecord } from '../../models/planning-collaboration/PlanningPort.types';
import { ImageBytesValidator } from '../../validators/development-tooling/ImageBytesValidator';

const IMAGE_MODEL = 'gpt-image-2.5-sunburst';
type PreparePageInput = Parameters<FeaturePlanPreparationDependencies['preparePage']>[0] & {
	referenceBytes: Uint8Array;
};
type FinalizeInput = { sourceCommit: string; pages: GeneratedPage[]; designs: PreparationPageDesign[] };
type Dependencies = {
	generator: Pick<ImageGenerator, 'generateImage'>;
	planning: Pick<PlanningPort, 'plans' | 'addDesign'>;
	revision(): Promise<string>;
	data(commit: string): Promise<ModuleData>;
};

function hash(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function referenceExtension(file: string): string {
	if (!safePath(file))
		throw new Error('Unsafe committed image path.');
	const extension = extname(file).toLowerCase();
	if (extension !== '.png') throw new Error('Only committed PNG design references are supported.');
	return extension;
}

function safePath(value: string): boolean {
	return Boolean(value) && !value.startsWith('/') && !value.includes('\\') &&
	!/[\x00-\x1f\x7f]/.test(value) &&
		!value.split('/').some((part) => !part || part === '.' || part === '..');
}

function validChoices(options: PreparePageInput['options']): boolean {
	return options.length === 3 && options.every((option) => Boolean(option.id.trim()) &&
		Boolean(option.direction.trim()) && Boolean(option.instruction.trim()) && typeof option.preferred === 'boolean') &&
		new Set(options.map((option) => option.id)).size === 3 &&
		new Set(options.map((option) => option.direction.trim().toLowerCase())).size === 3 &&
		options.filter((option) => option.preferred).length === 1;
}

function checkedReference(plan: PlanRecord, reference: PreparationDesignReference) {
	const version = plan.versions.find((item) => item.version === reference.version),
		image = version?.images.find((item) => item.sha256 === reference.sha256 && item.file === reference.file &&
			item.state === reference.state && item.viewport === reference.viewport && item.option === reference.option);
	if (
		!version || !image ||
		(reference.option && !version.options?.some((option) => option.id === reference.option))
	)
		throw new Error(`Committed design reference changed for ${reference.entityId}.`);
	return { version, image };
}

function choicesFor(version: DesignVersion, generated: GeneratedPage['options'], plan: PlanRecord, module: string): FeaturePlanPage {
	const pageOptions = generated.map((expected, index) => {
		const optionId = `o${index + 1}`,
			option = version.options?.find((item) => item.id === optionId),
			image = version.images.find((item) => item.option === optionId && option?.imageHashes.includes(item.sha256));
		if (
			expected.id !== optionId || !option || option.direction !== expected.direction ||
			option.prompt !== expected.prompt || option.revisedPrompt !== expected.revisedPrompt ||
			!image || image.bytes !== expected.bytes.byteLength || image.sha256 !== hash(expected.bytes) || !image.file ||
			!safePath(image.file)
		)
			throw new Error(`Committed design option ${optionId} is incomplete for ${module}.`);
		const path = posix.join(plan.path, 'designs', version.version, image.file);
		if (!safePath(path)) throw new Error(`Unsafe committed image path for ${module}.`);
		return {
			id: optionId,
			version: version.version,
			commit: version.commit!,
			path,
			sha256: image.sha256,
			preferred: expected.preferred
		};
	});
	if (pageOptions.filter((option) => option.preferred).length !== 1)
		throw new Error(`Exactly one preferred committed option is required for ${module}.`);
	return { module, options: pageOptions };
}

/** Generates referenced choices, then commits their complete image set in one serial pass. */
export class FeaturePlanPreparationHostService {
	constructor(private readonly dependencies: Dependencies) {}

	async preparePage(input: PreparePageInput) {
		input.signal.throwIfAborted();
		if (input.reference.entityId !== input.module || !validChoices(input.options))
			throw new Error(`Three distinct options, one preferred choice and an exact module reference are required for ${input.module}.`);
		const plan = (await this.dependencies.planning.plans(input.reference.commit))
			.find((record) => record.id === input.module);
		if (!plan) throw new Error(`The committed reference plan is unavailable for ${input.module}.`);
		checkedReference(plan, input.reference);
		if (hash(input.referenceBytes) !== input.reference.sha256)
			throw new Error(`Committed reference hash mismatch for ${input.module}.`);
		new ImageBytesValidator().validate(input.referenceBytes);
		const directory = await mkdtemp(join(tmpdir(), 'harness-feature-design-'));
		try {
			const reference = join(directory, 'reference' + referenceExtension(input.reference.file));
			await writeFile(reference, input.referenceBytes, { flag: 'wx', mode: 0o600 });
			const options = [];
			for (const choice of input.options) {
				input.signal.throwIfAborted();
				const prompt = `${input.imagePrompt}\nDesign direction: ${choice.direction}\nOption instruction: ${choice.instruction}`;
				const image = await this.dependencies.generator.generateImage({
					prompt,
					reference,
					cwd: directory,
					model: IMAGE_MODEL,
					signal: input.signal,
					onStatus: () => undefined
				});
				input.signal.throwIfAborted();
				new ImageBytesValidator().validate(image.bytes);
				options.push({
					id: choice.id,
					preferred: choice.preferred,
					direction: choice.direction,
					prompt,
					revisedPrompt: image.revisedPrompt,
					bytes: new Uint8Array(image.bytes)
				});
			}
			return { module: input.module, options };
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}

	async finalize(input: FinalizeInput, signal: AbortSignal) {
		const byDesign = new Map(input.designs.map((design) => [design.module, design])),
			modules = new Set(input.pages.map((page) => page.module));
		if (byDesign.size !== input.designs.length || modules.size !== input.pages.length ||
			input.pages.length !== byDesign.size || [...byDesign.keys()].some((module) => !modules.has(module)))
			throw new Error('Generated page set does not match its design references.');
		for (const generated of input.pages) {
			const design = byDesign.get(generated.module);
			if (!design || design.reference.entityId !== generated.module || !validChoices(design.options) ||
				generated.options.length !== 3 || design.options.length !== 3 ||
				generated.options.some((option, index) => option.id !== design.options[index]?.id ||
					option.direction !== design.options[index]?.direction || option.preferred !== design.options[index]?.preferred))
				throw new Error(`Invalid page design reference or generated options for ${generated.module}.`);
		}
		let current = input.sourceCommit;
		if ((await this.dependencies.revision()) !== current)
			throw new Error('Source revision changed before design finalization.');
		const sourcePlans = await this.dependencies.planning.plans(current);
		for (const design of input.designs) {
			const plan = sourcePlans.find((record) => record.id === design.module);
			if (!plan) throw new Error(`Missing exact reference plan for ${design.module}.`);
			checkedReference(plan, design.reference);
		}
		const pages: FeaturePlanPage[] = [];
		for (const generated of input.pages) {
			signal.throwIfAborted();
			const design = byDesign.get(generated.module);
			if (!design) throw new Error(`Missing design reference for ${generated.module}.`);
			if ((await this.dependencies.revision()) !== current)
				throw new Error('Source revision changed during design finalization.');
			const records = await this.dependencies.planning.plans(current),
				plan = records.find((record) => record.id === generated.module);
			if (!plan) throw new Error(`Missing exact reference plan for ${generated.module}.`);
			checkedReference(plan, design.reference);
			const expectedLatest = plan.versions.at(-1)?.version ?? null,
				added = await this.dependencies.planning.addDesign({
					entityId: generated.module,
					prompt: generated.options.map((option) => option.prompt).join('\n\n'),
					generator: { provider: 'codex', model: IMAGE_MODEL },
					baseRevision: input.sourceCommit,
					expectedLatest,
					state: design.reference.state,
					viewport: design.reference.viewport,
					bytes: null,
					revises: {
						version: design.reference.version,
						imageSha256: design.reference.sha256,
						region: design.region,
						threadId: null,
						...(design.reference.option ? { option: design.reference.option } : {})
					},
					options: generated.options.map(({ direction, bytes, prompt, revisedPrompt }) => ({
						direction,
						bytes,
						prompt,
						revisedPrompt
					}))
				});
			if (!added.commit || (await this.dependencies.revision()) !== added.commit)
				throw new Error(`Design commit for ${generated.module} is not the current branch tip.`);
			const updated = (await this.dependencies.planning.plans(added.commit)).find((record) => record.id === generated.module);
			if (!updated || updated.versions.at(-1)?.version !== added.version)
				throw new Error(`Committed design version could not be read for ${generated.module}.`);
			pages.push(choicesFor(added, generated.options, updated, generated.module));
			current = added.commit;
		}
		signal.throwIfAborted();
		const data = await this.dependencies.data(current);
		if (data.commit !== current) throw new Error('Final design metadata is not bound to the final commit.');
		return { sourceCommit: current, data, pages };
	}

}
