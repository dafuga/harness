import type { Command } from 'commander';
import { planSchema } from '../../repositories/agents-providers/module-task-repository/taskSchemas';
import { requireModuleData } from '../../services/git-source-history/module-data-service/moduleDataAdmission';
import { FeaturePlanCoverageValidator } from '../../validators/agents-providers/FeaturePlanCoverageValidator';

type Dependencies = {
	readData?: (commit: string) => ReturnType<typeof requireModuleData>;
	discover?: FeaturePlanCoverageValidator['discover'];
};

/** Discover page impact from the proposal and its committed module data. */
export async function featurePlanImpact(input: unknown, dependencies: Dependencies = {}) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		throw new Error('Feature plan impact requires a proposal object.');
	}
	const { sourceCommit, changes } = input as Record<string, unknown>;
	const proposal = planSchema.pick({ sourceCommit: true, changes: true }).parse({
		sourceCommit,
		changes
	});
	const readData = dependencies.readData ?? ((commit) => requireModuleData(process.cwd(), commit));
	const data = await readData(proposal.sourceCommit);
	const discovery = dependencies.discover
		? dependencies.discover(proposal, data)
		: new FeaturePlanCoverageValidator().discover(proposal, data);
	return { sourceCommit: proposal.sourceCommit, ...discovery };
}

export function registerFeaturePlanImpact(
	plan: Command,
	impact: typeof featurePlanImpact,
	readInput: (file: string) => Promise<unknown>,
	output: (text: string) => void
) {
	plan
		.command('impact')
		.requiredOption('--input <file>')
		.option('--json')
		.action(async (options: { input: string; json?: boolean }) => {
			const result = await impact(await readInput(options.input));
			if (options.json) output(JSON.stringify(result, null, 2));
			else {
				const pages = result.affectedPages.map((page) => `  ${page}`);
				const errors = result.errors.map((error) => `  ${error}`);
				output(
					[
						`Source: ${result.sourceCommit}`,
						'Affected pages:',
						...pages,
						'Blockers:',
						...errors
					].join('\n')
				);
			}
			if (!result.valid) process.exitCode = 1;
		});
}
