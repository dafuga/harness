import { readModuleSource } from './module-data-repository/readModuleSource';
import { ModuleDataSnapshotValidator } from '../../validators/development-tooling/ModuleDataSnapshotValidator';
import { createHash } from 'node:crypto';
import { EvidenceTreeAdapter } from '../../adapters/verification-evidence/EvidenceTreeAdapter';
import { canonicalJson } from '../../utils/development-tooling/canonicalJson';
import { stableJson } from '../../utils/development-tooling/stableJson';
import type { ModuleData } from '../../services/git-source-history/ModuleDataService.types';
import type { ModuleDataIdentity } from './ModuleDataRepository.types';
import { syncModuleData } from './module-data-repository/syncModuleData';
import {
	moduleDataProducer,
	moduleDataRef
} from '../../services/git-source-history/module-data-service/moduleDataProtocol';
export { moduleDataProducer };
/** Append-only Git snapshots; concurrent writers preserve each other's data and source ancestry. */
export class ModuleDataRepository {
	readonly ref = moduleDataRef;
	private readonly tree: EvidenceTreeAdapter;
	constructor(readonly root: string) {
		this.tree = new EvidenceTreeAdapter(root);
	}
	async identity(revision: string): Promise<ModuleDataIdentity> {
		const commit = await this.tree.git.run([
			'rev-parse',
			'--verify',
			'--end-of-options',
			`${revision}^{commit}`
		]);
		const tree = await this.tree.git.run(['rev-parse', `${commit}^{tree}`]);
		const read = (ref: string) => this.tree.tip(ref).then((tip) => tip ?? null);
		return {
			commit,
			tree,
			inputs: {
				notes: await read('refs/notes/harness'),
				evidence: await read('refs/heads/harness-evidence')
			}
		};
	}
	key(identity: ModuleDataIdentity): string {
		return this.digest({
			producer: moduleDataProducer,
			commit: identity.commit,
			tree: identity.tree,
			inputs: identity.inputs
		});
	}
	digest(data: unknown): string {
		return createHash('sha256').update(canonicalJson(data)).digest('hex');
	}
	async read(
		identity: ModuleDataIdentity
	): Promise<{ data: ModuleData; commit: string } | undefined> {
		const commit = await this.tree.tip(this.ref);
		if (!commit) return undefined;
		const bytes = await this.tree.read(commit, this.path(identity));
		if (!bytes) return undefined;
		try {
			const data = JSON.parse(bytes.toString()) as ModuleData;
			const { digest, ...body } = data;
			if (
				digest !== this.digest(body) ||
				this.key(data) !== this.key(identity) ||
				data.schemaVersion !== 1 ||
				!new ModuleDataSnapshotValidator().validate(data).valid ||
				data.producer !== moduleDataProducer
			)
				return undefined;
			return { data, commit };
		} catch {
			return undefined;
		}
	}
	async source(
		identity: ModuleDataIdentity
	): Promise<{ data: ModuleData; commit: string } | undefined> {
		return readModuleSource(this.tree, identity, this);
	}

	async write(data: ModuleData): Promise<string> {
		const { digest, ...body } = data;
		if (digest !== this.digest(body)) throw new Error('Invalid module data seal.');
		const checked = new ModuleDataSnapshotValidator().validate(data);
		if (!checked.valid) throw new Error(`Invalid module snapshot: ${checked.errors.join(' ')}`);
		for (let attempt = 0; attempt < 20; attempt++) {
			const prior = await this.tree.tip(this.ref);
			const same = await this.read(data);
			if (same?.data.digest === data.digest) return same.commit;

			const parents = [...new Set([...(prior ? [prior] : []), data.commit])];
			const next = await this.tree.commit({
				parents,
				message: 'chore: retain revision module data',
				files: [
					this.path(data),
					`snapshots/${data.commit}/${this.key(data)}/${data.digest}.json`
				].map((path) => ({ path, content: { bytes: Buffer.from(stableJson(data)) } }))
			});
			if (await this.tree.advance(this.ref, next, prior)) return next;
		}
		throw new Error('Module data changed repeatedly; retry validation.');
	}
	async sync(remote: string) {
		return syncModuleData(this.tree, this.ref, remote);
	}
	fetch(remote: string) {
		return syncModuleData(this.tree, this.ref, remote, false);
	}
	private path(identity: ModuleDataIdentity) {
		return `modules/${identity.commit}/${this.key(identity)}.json`;
	}
}
