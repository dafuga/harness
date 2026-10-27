import { planSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import type {
	FeaturePlanPreparationDependencies,
	FeaturePlanPreparationInput,
	PreparationPage,
	PreparationDiscovery,
	PreparationPageDesign,
	FeaturePlanProposal,
	GeneratedPage
} from './FeaturePlanPreparationService.types';

const pageSchema = planSchema.shape.pages.element,
	proposalSchema = planSchema.omit({ pages: true, revision: true, digest: true, approval: true });

function assertReport(report: PreparationDiscovery) {
	if (!report.valid || report.errors.length) throw new Error(`Feature preparation refused: ${report.errors.join('; ') || 'incomplete coverage'}`);
}
function checkedPage(value: PreparationPage, module: string): PreparationPage {
	const page = pageSchema.parse(value);
	if (page.module !== module || page.selected !== undefined || page.options.length !== 3)
		throw new Error(`Incomplete unselected design choices for ${module}.`);
	if (
		new Set(page.options.map((option) => option.id)).size !== 3 ||
		page.options.filter((option) => option.preferred).length !== 1
	)
		throw new Error(`Design choices for ${module} require distinct IDs and one preferred option.`);
	return structuredClone(value);
}
function checkedGeneratedPage(value: GeneratedPage, module: string, choices: PreparationPageDesign['options']): GeneratedPage {
	if (!value || value.module !== module || !Array.isArray(value.options) || value.options.length !== 3)
		throw new Error(`Incomplete generated choices for ${module}.`);
	const complete = value.options.every((option) =>
		option && nonempty(option.id) && typeof option.preferred === 'boolean' && nonempty(option.direction) &&
		nonempty(option.prompt) && (option.revisedPrompt === null || typeof option.revisedPrompt === 'string') &&
		option.bytes instanceof Uint8Array && option.bytes.byteLength > 0
	);
	if (!complete)
		throw new Error(`Generated choices for ${module} need complete prompts and image bytes.`);
	if (
		new Set(value.options.map((option) => option.id)).size !== 3 ||
		value.options.filter((option) => option.preferred).length !== 1 ||
		value.options.some((option, index) => {
			const expected = choices[index];
			return !expected || option.id !== expected.id || option.preferred !== expected.preferred ||
				option.direction !== expected.direction;
		})
	)
		throw new Error(`Generated choices for ${module} need distinct IDs, one preferred option and image bytes.`);
	return structuredClone(value);
}
const assertRevision = (sourceCommit: string, metadataCommit: string) => {
	if (!isRevision(sourceCommit) || sourceCommit !== metadataCommit) throw new Error('Feature preparation requires matching committed source metadata.');
};
function assertTaskGoals(proposal: FeaturePlanProposal) {
	if (!proposal.tasks.length || proposal.tasks.some((task) => !task.moduleGoal?.trim()))
		throw new Error('Every planned task needs its module goal and the shared feature context.');
}

function checkedPageDesigns(
	pageDesigns: PreparationPageDesign[],
	modules: string[],
	originalRequest: string
): Map<string, PreparationPageDesign> {
	if (typeof originalRequest !== 'string' || !originalRequest.trim())
		throw new Error('Feature preparation requires the original user request.');
	if (!Array.isArray(pageDesigns)) throw new Error('Feature preparation requires page design references.');
	const expected = new Set(modules),
		checked = new Map<string, PreparationPageDesign>();
	for (const page of pageDesigns) {
		if (!page || typeof page !== 'object' || typeof page.module !== 'string')
			throw new Error('Invalid page design context.');
		const { reference, region } = page;
		if (
			!expected.has(page.module) || checked.has(page.module) ||
			!reference || typeof reference !== 'object' ||
			!['current', 'wanted'].includes(reference.kind) ||
			reference.entityId !== page.module ||
			!isRevision(reference.commit) ||
			!nonempty(reference.version) || !nonempty(reference.state) || !nonempty(reference.viewport) ||
			!safeReferenceFile(reference.file) ||
			!/^[0-9a-f]{64}$/i.test(reference.sha256) ||
			(reference.option !== undefined && !nonempty(reference.option))
		)
			throw new Error(`Invalid design reference for ${page.module}.`);
		if (!validRegion(region)) throw new Error(`Invalid edit region for ${page.module}.`);
		if (!validChoices(page.options)) throw new Error(`Each page needs three distinct design options and one preferred choice: ${page.module}.`);
		checked.set(page.module, structuredClone(page));
	}
	const missing = modules.filter((module) => !checked.has(module));
	if (missing.length) throw new Error(`Missing design references: ${missing.join(', ')}.`);
	return checked;
}

const isRevision = (value: unknown): value is string => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const safeReferenceFile = (value: unknown): value is string => nonempty(value) && !value.startsWith('/') && !value.split(/[\\/]/).includes('..');
function validChoices(value: unknown): value is PreparationPageDesign['options'] {
	return Array.isArray(value) && value.length === 3 && value.every((choice) => choice && nonempty(choice.id) &&
		typeof choice.preferred === 'boolean' && nonempty(choice.direction) && nonempty(choice.instruction)) &&
		new Set(value.map((choice) => choice.id)).size === 3 && value.filter((choice) => choice.preferred).length === 1;
}

function validRegion(value: unknown): value is PreparationPageDesign['region'] {
	if (value === null) return true;
	if (!value || typeof value !== 'object') return false;
	const { x, y, width, height } = value as NonNullable<PreparationPageDesign['region']>;
	return [x, y, width, height].every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1 && y + height <= 1;
}

function imagePrompt(input: {
	goal: string;
	tldr: string;
	module: string;
	moduleGoal: string;
	originalRequest: string;
	region: PreparationPageDesign['region'];
}) {
	const region = input.region,
		scope = region
			? `Edit only normalized region x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}. Preserve everything outside it, including layout, text, spacing, colors, navigation and other panels.`
			: 'Change only what the user requests; preserve unrelated page content and structure.';
	return `Overall goal: ${input.goal}\nFeature TLDR: ${input.tldr}\nPage module: ${input.module}\nModule goal: ${input.moduleGoal}\nUser request: ${input.originalRequest}\nUse the exact committed reference image as the GPT Image edit input.\n${scope}`;
}

export class FeaturePlanPreparationService {
	constructor(private readonly dependencies?: FeaturePlanPreparationDependencies) {}

	async prepare(input: FeaturePlanPreparationInput) {
		const { signal } = input;
		signal.throwIfAborted();
		const deps = this.dependencies;
		if (!deps) throw new Error('Feature preparation collaborators are required.');
		const { proposal, data } = structuredClone({ proposal: input.proposal, data: input.data });
		proposalSchema.parse(proposal);
		assertTaskGoals(proposal);
		assertRevision(proposal.sourceCommit, data.commit);
		const discovery = await deps.discover(
			{ sourceCommit: proposal.sourceCommit, changes: structuredClone(proposal.changes) },
			data
		);
		assertReport(discovery);
		signal.throwIfAborted();
		const modules = [...new Set(discovery.affectedPages)].sort();
		for (const module of modules) pageSchema.shape.module.parse(module);
		const missingPageTasks = modules.filter((module) => !proposal.tasks.some((task) => task.module === module));
		if (missingPageTasks.length) throw new Error(`Affected pages need page-level tasks: ${missingPageTasks.join(', ')}.`);
		const originalRequest = input.originalRequest,
			pageDesigns = checkedPageDesigns(input.pageDesigns, modules, originalRequest);
		const generated = await this.preparePages(modules, proposal, originalRequest, pageDesigns, signal);
		const finalized = await deps.finalize(
			{
				sourceCommit: proposal.sourceCommit,
				pages: structuredClone(generated),
				designs: [...pageDesigns.values()].map((design) => structuredClone(design))
			},
			signal
		);
		signal.throwIfAborted();
		assertRevision(finalized.sourceCommit, finalized.data.commit);
		if (finalized.pages.length !== modules.length)
			throw new Error('Design finalization returned incomplete page artifacts.');
		const pages = finalized.pages.map((page, index) => checkedPage(page, modules[index]!));
		const candidate = { ...proposal, sourceCommit: finalized.sourceCommit, pages };
		const coverage = await deps.verify(structuredClone(candidate), finalized.data);
		assertReport(coverage);
		if (coverage.missingPages.length)
			throw new Error(`Missing designs: ${coverage.missingPages.join(', ')}`);
		signal.throwIfAborted();
		return deps.draft(candidate);
	}

	private async preparePages(
		modules: string[],
		proposal: FeaturePlanProposal,
		originalRequest: string,
		pageDesigns: Map<string, PreparationPageDesign>,
		signal: AbortSignal
	) {
		const deps = this.dependencies!;
		const settled = await Promise.allSettled(
			modules.map(async (module) => {
				signal.throwIfAborted();
				const design = pageDesigns.get(module)!,
					moduleGoal = proposal.tasks.find((task) => task.module === module)!.moduleGoal!;
				return deps.admit(async () => {
					signal.throwIfAborted();
					const page = await deps.preparePage({
						module,
						moduleGoal,
						options: structuredClone(design.options),
						sourceCommit: proposal.sourceCommit,
						count: 3,
						goal: proposal.goal,
						tldr: proposal.tldr,
						originalRequest,
						reference: structuredClone(design.reference),
						region: design.region && structuredClone(design.region),
						imagePrompt: imagePrompt({
							goal: proposal.goal,
							tldr: proposal.tldr,
							module,
							moduleGoal,
							originalRequest,
							region: design.region
						}),
						signal
					});
					signal.throwIfAborted();
					return checkedGeneratedPage(page, module, design.options);
				});
			})
		);
		signal.throwIfAborted();
		return settled.map((result) => {
			if (result.status === 'rejected') throw result.reason;
			return result.value;
		});
	}
}
