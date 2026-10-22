import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import {
	VerificationStoreRepository,
	type StoredRecord
} from '../../repositories/verification-evidence/VerificationStoreRepository';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import { componentVersion } from '../../utils/development-tooling/componentVersion';
import type { ComponentVersion } from '../../utils/componentVersion';
import type { ComponentManifest } from '../../core/unitTypes';
import { canonicalJson } from '../../utils/canonicalJson';
import { recordLineage } from '../../utils/development-tooling/recordLineage';
import { recordIntact } from '../../utils/verification-evidence/sealRecord';
import { loadSide } from '../../workflows/development-tooling/loadRevisions';
import { SourceIndexService } from '../development-tooling/source-index-service/SourceIndexService';

export interface CheckReport {
	status: 'passed' | 'failed';
	commit: string;
	record: string;
	problems: string[];
}

/** Decides whether a stored record really proves one commit: identity, integrity, outcome. */
export class VerificationCheckService {
	/**
	 * `indexer` may be shared by checks of several commits: it reuses only what it parsed of a file
	 * with the very same content, and every commit is still indexed and compared in full.
	 */
	constructor(
		private readonly root: string,
		private readonly indexer: SourceIndexService = new SourceIndexService()
	) {}

	async check(commit: string, stored: StoredRecord): Promise<CheckReport> {
		const { record } = stored;
		const integrity = await this.integrity(commit, stored);
		const problems = [
			...integrity,
			...(integrity.length > 0 ? [] : this.lineage(record)),
			...(record.status === 'passed' ? [] : record.failures)
		];
		return {
			status: problems.length === 0 ? 'passed' : 'failed',
			commit,
			record: record.id,
			problems
		};
	}

	/** Identity and integrity of one record, whatever its outcome: what attaching it requires. */
	async integrity(commit: string, stored: StoredRecord): Promise<string[]> {
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
			...this.evidence(record, directory)
		];
	}

	/**
	 * A record is only as good as what it inherits: its base record and the records behind
	 * referenced scenarios must be stored, sealed and intact, all the way to the root.
	 */
	private lineage(record: VerificationRecord): string[] {
		const store = new VerificationStoreRepository(this.root);
		const stored = new Map(store.all().map((item) => [item.record.id, item]));
		return recordLineage(record, {
			find: (id) => stored.get(id)?.record,
			problems: (dependency) => {
				const found = stored.get(dependency.id);
				if (!found) return ['its files are not stored'];
				const sealed = recordIntact(dependency) ? [] : ['record content does not match its id'];
				return [...sealed, ...this.evidence(dependency, found.directory)];
			}
		});
	}

	/** Recomputes each recorded unit version from the commit itself. */
	private async components(commit: string, record: VerificationRecord): Promise<string[]> {
		const tree = await CommitTreeAdapter.open(this.root, commit);
		const head = await loadSide(this.root, tree, this.indexer);
		return record.components
			.filter((component) => component.change !== 'removed')
			.filter((component) => {
				const manifest = head.manifests.find((unit) => unit.id === component.unit);
				const actual = manifest ? componentVersion(manifest, head.index.files) : undefined;
				if (sameVersion(component, actual)) return false;
				const stored = head.stored.find((unit) => unit.id === component.unit);
				const historical = historicalContract(manifest, stored);
				return !sameVersion(
					component,
					historical ? componentVersion(historical, head.index.files) : undefined
				);
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

function sameVersion(recorded: ComponentVersion, actual?: ComponentVersion): boolean {
	return (['manifest', 'source', 'contract', 'runtime'] as const).every(
		(key) => actual?.[key] === recorded[key]
	);
}

/** Only derived contract interpretation may drift; all other committed metadata must agree. */
function historicalContract(
	fresh?: ComponentManifest,
	stored?: ComponentManifest
): ComponentManifest | undefined {
	if (fresh?.contract.origin !== 'derived' || stored?.contract.origin !== 'derived')
		return undefined;
	return canonicalJson({ ...stored, contract: fresh.contract }) === canonicalJson(fresh)
		? stored
		: undefined;
}
