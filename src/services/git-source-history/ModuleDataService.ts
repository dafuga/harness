import type { ModuleReviewInput } from '../../repositories/git-source-history/ModuleDataReviewRepository.types';
import { ModuleDataReviewRepository } from '../../repositories/git-source-history/ModuleDataReviewRepository';
import { readModuleReviews } from './module-data-service/moduleReviews';
import { requireModuleData } from './module-data-service/moduleDataAdmission';
import type { HistoryValidationReport } from './ModuleDataService.types';
import { SourceHistoryRepository } from '../../repositories/git-source-history/source-history-repository/SourceHistoryRepository';
import type { ModuleDataIdentity } from '../../repositories/git-source-history/ModuleDataRepository.types';
import { ModuleDataBuilder } from './module-data-service/ModuleDataBuilder';
import { ModuleDataCache } from './module-data-service/ModuleDataCache';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { ModuleDataRepository } from '../../repositories/git-source-history/ModuleDataRepository';
import type { ModuleData, ValidateOptions, ValidationReport } from './ModuleDataService.types';

/** Validate exact Git revisions; missing facts are cached and committed as gaps, never fabricated. */
export class ModuleDataService {
	private readonly repository: ModuleDataRepository;
	private readonly builder: ModuleDataBuilder;
	constructor(readonly root: string) {
		this.repository = new ModuleDataRepository(root);
		this.builder = new ModuleDataBuilder(this.repository);
	}

	async validate(
		options: ValidateOptions = {},
		reviews?: ModuleReviewInput[]
	): Promise<ValidationReport> {
		const identity = await this.repository.identity(options.commit ?? 'HEAD');
		const stored = await this.repository.read(identity);
		let cache = await this.load(identity, Boolean(options.refresh), stored?.data);
		const requested = reviews ?? (await readModuleReviews(options.review));
		if (requested.length) {
			if (!options.write) throw new Error('--review requires --write.');
			await new ModuleDataReviewRepository(this.root).write(
				identity,
				cache.data.declarations,
				requested
			);
			cache = await this.load(identity, true);
		}
		await new ModuleDataCache(this.repository).write(cache.data);
		const metadataCommit = options.write ? await this.repository.write(cache.data) : stored?.commit;
		return this.report(cache.data, options, {
			committed: Boolean(metadataCommit),
			cached: cache.hit,
			metadataCommit
		});
	}
	private async load(identity: ModuleDataIdentity, refresh: boolean, stored?: ModuleData) {
		if (refresh)
			return {
				data: await this.builder.build(identity, true),
				hit: false
			};
		const data = stored ?? (await new ModuleDataCache(this.repository).read(identity));
		if (data) return { data, hit: true };
		return { data: await this.builder.build(identity), hit: false };
	}

	async history(options: ValidateOptions = {}): Promise<HistoryValidationReport> {
		const git = new GitAdapter(this.root);
		const tip = (await this.repository.identity(options.commit ?? 'HEAD')).commit;
		const commits = options.all
			? (await new SourceHistoryRepository(this.root).read(1_000_000)).revisions
					.map((item) => item.commit)
					.reverse()
			: (await git.run(['rev-list', '--reverse', tip])).split('\n').filter(Boolean);
		const reviews = await readModuleReviews(options.review);
		if (reviews.some((review) => !review.commit))
			throw new Error('Historical reviews must name exact source commits.');
		if (reviews.some((review) => !commits.includes(review.commit!)))
			throw new Error('Review source commit is outside the selected history.');
		const revisions: HistoryValidationReport['revisions'] = [];
		let modules: ValidationReport['modules'] = [];
		for (const commit of commits) {
			const report = await this.validate(
				{ ...options, review: undefined, history: false, commit },
				reviews.filter((review) => review.commit === commit)
			);
			modules = report.modules;
			revisions.push(historySummary(report));
		}
		return {
			commit: tip,
			valid: revisions.every((item) => item.valid),
			modules,
			revisions
		};
	}
	async require(commit: string, module?: string): Promise<ModuleData> {
		return requireModuleData(this.root, commit, module);
	}
	async sync(remote: string) {
		return this.repository.sync(remote);
	}
	private report(
		data: ModuleData,
		options: ValidateOptions,
		state: Pick<ValidationReport, 'committed' | 'cached' | 'metadataCommit'>
	): ValidationReport {
		const modules = data.modules.filter(
			(unit) =>
				(!options.module || unit.id === options.module) &&
				(!options.type || unit.kind === options.type || unit.category === options.type)
		);
		const issues = [...data.issues];
		if (options.module && !modules.length) issues.push(`Unknown module: ${options.module}`);
		if (options.type && !modules.length)
			issues.push(`Unknown or empty module type: ${options.type}`);
		if (!state.committed)
			issues.push('Missing committed module data; run harness validate --write.');
		return {
			commit: data.commit,
			valid:
				issues.length === 0 &&
				modules.every((unit) => unit.issues.every((issue) => issue.kind === 'evidence')),
			complete: issues.length === 0 && modules.every((unit) => unit.issues.length === 0),
			evidenceGaps: modules.reduce(
				(count, unit) => count + unit.issues.filter((issue) => issue.kind === 'evidence').length,
				0
			),
			...state,
			modules,
			issues,
			digest: data.digest
		};
	}
}

function historySummary({ modules, ...report }: ValidationReport) {
	return {
		...report,
		moduleCount: modules.length,
		missingModules: modules.filter((unit) => unit.issues.length).length,
		issueCount: modules.reduce((count, unit) => count + unit.issues.length, report.issues.length)
	};
}
