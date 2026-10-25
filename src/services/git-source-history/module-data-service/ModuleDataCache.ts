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
		try {
			const data = JSON.parse(await readFile(this.path(identity, source), 'utf8')) as ModuleData;
			const { digest, ...body } = data;
			return data.producer === moduleDataProducer &&
				new ModuleDataSnapshotValidator().validate(data).valid &&
				digest === this.repository.digest(body) &&
				(source
					? data.commit === identity.commit &&
						data.tree === identity.tree &&
						data.producer === moduleDataProducer
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

	private path(identity: ModuleDataIdentity, source = false) {
		return join(
			this.repository.root,
			'.cache/harness/module-data',
			`${source ? 'source-' + this.repository.digest([identity.commit, identity.tree, moduleDataProducer]) : this.repository.key(identity)}.json`
		);
	}
}
