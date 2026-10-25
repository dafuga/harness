import { createHash } from 'node:crypto';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { ModuleDataIdentity } from './ModuleDataRepository.types';
import type { ModuleReview } from './ModuleDataReviewRepository.types';
import { EvidenceTreeAdapter } from '../../adapters/verification-evidence/EvidenceTreeAdapter';
import { canonicalJson } from '../../utils/development-tooling/canonicalJson';
import { moduleDataRef } from '../../services/git-source-history/module-data-service/moduleDataProtocol';
import { moduleReviewSchema } from './module-data-review-repository/moduleReviewSchema';
/** Commit source-bound authoring separately from source history; evidence and ownership are immutable. */
export class ModuleDataReviewRepository {
	private tree: EvidenceTreeAdapter;
	constructor(root: string) {
		this.tree = new EvidenceTreeAdapter(root);
	}
	async read(identity: ModuleDataIdentity): Promise<ModuleReview[]> {
		const tip = await this.tree.tip(moduleDataRef);
		if (!tip) return [];
		const paths = [...(await this.tree.list(tip)).keys()].filter((path) =>
			path.startsWith(`reviews/${identity.commit}/`)
		);
		return Promise.all(
			paths.map(async (path) => {
				const review = JSON.parse((await this.tree.read(tip, path))!.toString()) as ModuleReview;
				const { digest, ...body } = review;
				if (
					seal(body) !== digest ||
					review.commit !== identity.commit ||
					review.tree !== identity.tree
				)
					throw new Error(`Invalid source-bound metadata review: ${path}`);
				moduleReviewSchema.parse({
					unit: review.unit,
					reason: review.reason,
					metadata: review.metadata
				});
				return review;
			})
		);
	}
	async write(
		identity: ModuleDataIdentity,
		units: ComponentManifest[],
		input: unknown
	): Promise<void> {
		const blobs = await this.tree.list(identity.commit);
		const inputs = Array.isArray(input) ? input : [input];
		const reviews = inputs.map((item) => this.bind(identity, units, item, blobs));
		if (reviews.length) await this.commit(reviews);
	}
	private bind(
		identity: ModuleDataIdentity,
		units: ComponentManifest[],
		input: unknown,
		blobs: Map<string, string>
	) {
		const requested = moduleReviewSchema.parse(input);
		if (requested.commit && requested.commit !== identity.commit)
			throw new Error('Review belongs to a different source commit.');
		const unit = units.find((unit) => unit.id === requested.unit);
		if (!unit) throw new Error(`Unknown review module: ${requested.unit}`);
		const files = Object.fromEntries(
			unit.owns.source.map((path) => {
				const hash = blobs.get(path);
				if (!hash) throw new Error(`Cannot review missing source: ${path}`);
				return [path, hash];
			})
		);
		const body = {
			...requested,
			schemaVersion: 1 as const,
			commit: identity.commit,
			tree: identity.tree,
			files
		};
		return { ...body, digest: seal(body) };
	}

	private async commit(reviews: ModuleReview[]) {
		const files = reviews.flatMap((review) => {
			const bytes = Buffer.from(canonicalJson(review));
			return [
				`reviews/${review.commit}/${review.unit}.json`,
				`review-snapshots/${review.commit}/${review.unit}/${review.digest}.json`
			].map((path) => ({ path, content: { bytes } }));
		});
		for (let attempt = 0; attempt < 20; attempt++) {
			const prior = await this.tree.tip(moduleDataRef);
			if (
				prior &&
				(
					await Promise.all(
						files.map(async (file) =>
							(await this.tree.read(prior, file.path))?.equals(file.content.bytes)
						)
					)
				).every(Boolean)
			)
				return;
			const parents = [
				...new Set([...(prior ? [prior] : []), ...reviews.map((review) => review.commit)])
			];
			const next = await this.tree.commit({
				parents,
				message: 'chore: review historical module metadata',
				files
			});
			if (await this.tree.advance(moduleDataRef, next, prior)) return;
		}
		throw new Error('Metadata reviews changed repeatedly; retry.');
	}
}
function seal(body: unknown) {
	return createHash('sha256').update(canonicalJson(body)).digest('hex');
}
