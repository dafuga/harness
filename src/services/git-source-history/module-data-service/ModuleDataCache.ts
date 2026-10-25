import { moduleReviewDigest } from '../../../repositories/git-source-history/module-data-repository/readModuleSource';
import { ModuleDataSnapshotValidator } from '../../../validators/development-tooling/ModuleDataSnapshotValidator';
import { moduleDataProducer } from './moduleDataProtocol';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModuleDataIdentity } from '../../../repositories/git-source-history/ModuleDataRepository.types';
import type { ModuleDataRepository } from '../../../repositories/git-source-history/ModuleDataRepository';
import type { ModuleData } from '../ModuleDataService.types';
export class ModuleDataCache {
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
			const data = JSON.parse(
				await readFile(this.path(identity, source, producer), 'utf8')
			) as ModuleData;
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
		await mkdir(join(this.repository.root, '.cache/harness/module-data'), { recursive: true });
		const text = JSON.stringify(data);
		for (const source of [false, true]) {
			const path = this.path(data, source),
				temporary = `${path}.${randomUUID()}.tmp`;
			await writeFile(temporary, text);
			await rename(temporary, path);
		}
	}

	private path(identity: ModuleDataIdentity, source = false, producer = moduleDataProducer) {
		return join(
			this.repository.root,
			'.cache/harness/module-data',
			`${source ? 'source-' + this.repository.digest([identity.commit, identity.tree, producer]) : this.repository.key(identity)}.json`
		);
	}
}
