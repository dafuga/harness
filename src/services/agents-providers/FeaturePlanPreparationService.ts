import { planSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import type {
	FeaturePlanPreparationDependencies,
	FeaturePlanPreparationInput,
	PreparationPage,
	PreparationDiscovery
} from './FeaturePlanPreparationService.types';

const pageSchema = planSchema.shape.pages.element;
const proposalSchema = planSchema.omit({
	pages: true,
	revision: true,
	digest: true,
	approval: true
});

function assertReport(report: PreparationDiscovery) {
	if (!report.valid || report.errors.length)
		throw new Error(
			`Feature preparation refused: ${report.errors.join('; ') || 'incomplete coverage'}`
		);
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

function assertRevision(sourceCommit: string, metadataCommit: string) {
	if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sourceCommit) || sourceCommit !== metadataCommit)
		throw new Error('Feature preparation requires matching committed source metadata.');
}

export class FeaturePlanPreparationService {
	constructor(private readonly dependencies?: FeaturePlanPreparationDependencies) {}

	run(): string {
		return 'feature-plan-preparation';
	}

	async prepare(input: FeaturePlanPreparationInput) {
		const { signal } = input;
		signal.throwIfAborted();
		const deps = this.dependencies;
		if (!deps) throw new Error('Feature preparation collaborators are required.');
		const { proposal, data } = structuredClone({ proposal: input.proposal, data: input.data });
		proposalSchema.parse(proposal);
		assertRevision(proposal.sourceCommit, data.commit);
		const discovery = await deps.discover(
			{ sourceCommit: proposal.sourceCommit, changes: structuredClone(proposal.changes) },
			data
		);
		assertReport(discovery);
		signal.throwIfAborted();
		const modules = [...new Set(discovery.affectedPages)].sort();
		for (const module of modules) pageSchema.shape.module.parse(module);
		const pages = await this.preparePages(modules, proposal.sourceCommit, signal);
		const finalized = await deps.finalize(
			{ sourceCommit: proposal.sourceCommit, pages: structuredClone(pages) },
			signal
		);
		signal.throwIfAborted();
		assertRevision(finalized.sourceCommit, finalized.data.commit);
		const candidate = { ...proposal, sourceCommit: finalized.sourceCommit, pages };
		const coverage = await deps.verify(structuredClone(candidate), finalized.data);
		assertReport(coverage);
		if (coverage.missingPages.length)
			throw new Error(`Missing designs: ${coverage.missingPages.join(', ')}`);
		signal.throwIfAborted();
		return deps.draft(candidate);
	}

	private async preparePages(modules: string[], sourceCommit: string, signal: AbortSignal) {
		const deps = this.dependencies!;
		const settled = await Promise.allSettled(
			modules.map(async (module) => {
				signal.throwIfAborted();
				return deps.admit(async () => {
					signal.throwIfAborted();
					const page = await deps.preparePage({ module, sourceCommit, count: 3, signal });
					signal.throwIfAborted();
					return checkedPage(page, module);
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
