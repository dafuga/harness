import type { EvidenceTreeAdapter } from '../../../adapters/verification-evidence/EvidenceTreeAdapter';
import type { ModuleDataIdentity } from '../ModuleDataRepository.types';
import type { ModuleDataRepository } from '../ModuleDataRepository';
import type { ModuleData } from '../../../services/git-source-history/ModuleDataService.types';
import { ModuleDataSnapshotValidator } from '../../../validators/development-tooling/ModuleDataSnapshotValidator';
import { ModuleDataReviewRepository } from '../ModuleDataReviewRepository';
import { moduleDataProducer } from '../../../services/git-source-history/module-data-service/moduleDataProtocol';
/** Evidence may advance without changing committed metadata about the same source tree. */
export async function readModuleSource(
	tree: EvidenceTreeAdapter,
	identity: ModuleDataIdentity,
	repository: ModuleDataRepository
) {
	const tip = await tree.tip(repository.ref);
	if (!tip) return undefined;
	const reviews = await moduleReviewDigest(repository.root, identity);
	const paths = [...(await tree.list(tip)).keys()].filter((path) =>
		path.startsWith(`modules/${identity.commit}/`)
	);
	for (const path of paths) {
		try {
			const bytes = await tree.read(tip, path);
			if (!bytes) continue;
			const data = JSON.parse(bytes.toString()) as ModuleData;
			if (matchesModuleSource(data, identity, reviews, repository)) return { data, commit: tip };
		} catch {
			continue;
		}
	}
	return undefined;
}

export function matchesModuleSource(
	data: ModuleData,
	identity: ModuleDataIdentity,
	reviews: string,
	repository: ModuleDataRepository
) {
	const { digest, ...body } = data;
	return (
		data.schemaVersion === 1 &&
		data.producer === moduleDataProducer &&
		data.commit === identity.commit &&
		data.tree === identity.tree &&
		(data.reviews ?? [])
			.map((item) => item.digest)
			.sort()
			.join() === reviews &&
		new ModuleDataSnapshotValidator().validate(data).valid &&
		digest === repository.digest(body)
	);
}

export async function moduleReviewDigest(root: string, identity: ModuleDataIdentity) {
	return (await new ModuleDataReviewRepository(root).read(identity))
		.map((item) => item.digest)
		.sort()
		.join();
}
