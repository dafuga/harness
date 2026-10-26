import { createPlanning } from '../../../packages/planning/src/index';
import { GitAdapter } from '../git-source-history/GitAdapter';
import { requireModuleData } from '../../services/git-source-history/module-data-service/moduleDataAdmission';
import { FeaturePlanValidator } from '../../validators/agents-providers/FeaturePlanValidator';
import type { FeaturePlan } from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	FeaturePlanReadinessAdapterConfig,
	FeaturePlanReadinessDependencies
} from './FeaturePlanReadinessAdapter.types';

export class FeaturePlanReadinessAdapter {
	private readonly root: string;
	private readonly config: FeaturePlanReadinessAdapterConfig;

	constructor(
		root: string | FeaturePlanReadinessAdapterConfig = process.cwd(),
		private readonly dependencies: FeaturePlanReadinessDependencies = {}
	) {
		this.root = typeof root === 'string' ? root : process.cwd();
		this.config = typeof root === 'string' ? {} : root;
	}

	connect(): string {
		return this.config.name ?? 'feature-plan-readiness';
	}

	async verify(plan: FeaturePlan): Promise<void> {
		const snapshot = structuredClone(plan);
		const validator = this.dependencies.validator ?? new FeaturePlanValidator();
		const validation = validator.validate(snapshot, { requireSelection: true });
		if (!validation.valid) throw new Error(validation.errors.join(' ') || 'Invalid feature plan.');
		const git = this.dependencies.git ?? new GitAdapter(this.root);
		const head = (await git.run(['rev-parse', 'HEAD'])).trim();
		if (head !== snapshot.sourceCommit) throw new Error('Feature plan source is not current HEAD.');
		await (this.dependencies.requireMetadata ?? requireModuleData)(
			this.root,
			snapshot.sourceCommit
		);
		const planning = this.dependencies.planning ?? (await createPlanning(this.root));
		for (const page of snapshot.pages) {
			for (const option of page.options) {
				await planning.readImage({
					unitId: page.module,
					version: option.version,
					file: option.path,
					revision: option.commit,
					sha256: option.sha256,
					option: option.id
				});
			}
		}
		if ((await git.run(['rev-parse', 'HEAD'])).trim() !== head) {
			throw new Error('Feature plan source changed during readiness verification.');
		}
	}
}

export type {
	FeaturePlanReadinessAdapterConfig,
	FeaturePlanReadinessDependencies
} from './FeaturePlanReadinessAdapter.types';
