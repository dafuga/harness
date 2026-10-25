import { moduleReviewDigest } from '../../../repositories/git-source-history/module-data-repository/readModuleSource';
import { ModuleDataSnapshotValidator } from '../../../validators/development-tooling/ModuleDataSnapshotValidator';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { moduleDataProducer } from './moduleDataProtocol';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModuleDataIdentity } from '../../../repositories/git-source-history/ModuleDataRepository.types';
import type { ModuleDataRepository } from '../../../repositories/git-source-history/ModuleDataRepository';
import type { ModuleData } from '../ModuleDataService.types';
export class ModuleDataCache {
	private directory?: Promise<string>;
	constructor(private repository: ModuleDataRepository) {}
	async read(identity: ModuleDataIdentity, source = false): Promise<ModuleData | undefined> {
		const current = await this.readVersion(identity, source, moduleDataProducer);
		if (current || !source) return current;
		// Version 5 only separates layout policy from metadata admission. Reuse sealed source
		// facts from version 4, then run the current validator; never reuse old admission results.
		return this.readVersion(identity, true, 'harness-module-data-v1.2026-10-25.4');
	}
	private async readVersion(identity: ModuleDataIdentity, source: boolean, producer: string) {
		try {
			const data = JSON.parse(await this.text(identity, source, producer)) as ModuleData;
			const { digest, ...body } = data;
			return data.producer === producer &&
				(data.reviews ?? [])
					.map((item) => item.digest)
					.sort()
					.join() === (await moduleReviewDigest(this.repository.root, identity)) &&
				new ModuleDataSnapshotValidator().validate(data).valid &&
				digest === this.repository.digest(body) &&
				(source
					? data.commit === identity.commit && data.tree === identity.tree
					: this.repository.key(data) === this.repository.key(identity))
				? data
				: undefined;
		} catch {
			return undefined;
		}
	}

	async write(data: ModuleData) {
		const directory = await this.cacheDirectory();
		await mkdir(directory, { recursive: true });
		const text = JSON.stringify(data);
		for (const source of [false, true]) {
			const path = join(directory, this.filename(data, source)),
				temporary = `${path}.${randomUUID()}.tmp`;
			await writeFile(temporary, text);
			await rename(temporary, path);
		}
	}

	private filename(identity: ModuleDataIdentity, source = false, producer = moduleDataProducer) {
		return `${source ? 'source-' + this.repository.digest([identity.commit, identity.tree, producer]) : this.repository.key(identity)}.json`;
	}
	private cacheDirectory() {
		return (this.directory ??= new GitAdapter(this.repository.root)
			.run(['rev-parse', '--absolute-git-dir'])
			.then((directory) => join(directory, 'harness/module-data')));
	}
	private async text(identity: ModuleDataIdentity, source: boolean, producer: string) {
		const name = this.filename(identity, source, producer);
		try {
			return await readFile(join(await this.cacheDirectory(), name), 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			// Existing sealed caches remain readable; new cache files never enter source worktrees.
			return readFile(join(this.repository.root, '.cache/harness/module-data', name), 'utf8');
		}
	}
}
