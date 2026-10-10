import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../adapters/CommitTreeAdapter';
import { GitAdapter } from '../adapters/GitAdapter';
import type { StoredRecord } from '../repositories/VerificationStoreRepository';
import type { VerificationRecord } from '../core/verificationTypes';
import { componentVersion } from '../utils/componentVersion';
import { recordIntact } from '../utils/sealRecord';
import { loadSide } from '../workflows/loadRevisions';
import { SourceIndexService } from './SourceIndexService';

export interface CheckReport {
	status: 'passed' | 'failed';
	commit: string;
	record: string;
	problems: string[];
}

/** Decides whether a stored record really proves one commit: identity, integrity, outcome. */
export class VerificationCheckService {
	constructor(private readonly root: string) {}

	async check(commit: string, stored: StoredRecord): Promise<CheckReport> {
		const { record } = stored;
		const problems = await this.problems(commit, stored);
		return {
			status: problems.length === 0 ? 'passed' : 'failed',
			commit,
			record: record.id,
			problems
		};
	}

	private async problems(commit: string, stored: StoredRecord): Promise<string[]> {
		const { record, directory } = stored;
		if (record.source.commit !== commit) {
			return [`record is for commit ${record.source.commit}, not ${commit}`];
		}
		const tree = await new GitAdapter(this.root).run(['rev-parse', `${commit}^{tree}`]);
		const identity =
			record.source.tree === tree
				? []
				: [`record tree ${record.source.tree} does not match commit tree ${tree}`];
		return [
			...identity,
			...(recordIntact(record) ? [] : ['record content does not match its id']),
			...(await this.components(commit, record)),
			...this.evidence(record, directory),
			...(record.status === 'passed' ? [] : record.failures)
		];
	}

	/** Recomputes each recorded unit version from the commit itself. */
	private async components(commit: string, record: VerificationRecord): Promise<string[]> {
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const head = await loadSide(this.root, tree, new SourceIndexService());
		return record.components
			.filter((component) => component.change !== 'removed')
			.filter((component) => {
				const manifest = head.manifests.find((unit) => unit.id === component.unit);
				const actual = manifest ? componentVersion(manifest, head.index.files) : undefined;
				const same = (key: 'manifest' | 'source' | 'contract' | 'runtime') =>
					actual?.[key] === component[key];
				return !(same('manifest') && same('source') && same('contract') && same('runtime'));
			})
			.map((component) => `component ${component.unit} does not match the source at this commit`);
	}

	/** Every file this run produced must still exist with the hash the record states. */
	private evidence(record: VerificationRecord, directory: string): string[] {
		const captures = record.scenarios
			.filter((scenario) => scenario.status !== 'referenced')
			.flatMap((scenario) => scenario.states.flatMap((state) => state.captures));
		const files = [...captures, ...record.tests.map((test) => test.log)];
		return files.flatMap((file) => {
			const path = join(directory, file.path);
			if (!existsSync(path)) return [`evidence ${file.path} is missing`];
			const hash = createHash('sha256').update(readFileSync(path)).digest('hex');
			return hash === file.sha256 ? [] : [`evidence ${file.path} does not match its recorded hash`];
		});
	}
}
