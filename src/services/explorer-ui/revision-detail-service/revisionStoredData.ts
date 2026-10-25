import { GitAdapter } from '../../../adapters/GitAdapter';
import { CommitTreeAdapter } from '../../../adapters/CommitTreeAdapter';
import { UnitRegistryRepository } from '../../../repositories/UnitRegistryRepository';
import { ScenarioRepository } from '../../../repositories/ScenarioRepository';
import { BudgetLedgerRepository } from '../../../repositories/BudgetLedgerRepository';
import { BudgetService } from '../../budget-service/BudgetService';
import { revisionRegistry } from '../../../utils/revisionRegistry';
import { unitMetadata } from './unitMetadata';
import { readPlatformCatalog } from './platformCatalog';
import { projectDependencies } from './projectDependencies';
import { translationCatalog } from './translationCatalog';
import { revisionReasons } from '../../../utils/revisionReasons';
import type { VerificationRecord } from '../../../core/verificationTypes';
import type { HistoryStatusService } from '../../history-status-service/HistoryStatusService';
import type { Stored } from './RevisionDetailService.types';
import type { RevisionSources } from './revisionStoredData.types';
/** Revisions with one tree share its registry and frozen budget ledger. */
export async function revisionRegistryAt(
	root: string,
	commit: string,
	kept: RevisionSources
): Promise<Stored> {
	const key =
		(await new GitAdapter(root).attempt([
			'rev-parse',
			'--verify',
			'--quiet',
			`${commit}^{tree}`
		])) ?? commit;
	const known = kept.registries.get(key);
	if (known) return known;
	const tree = await CommitTreeAdapter.open(root, commit);
	const units = await new UnitRegistryRepository(root).read(tree);
	const scenarios = await new ScenarioRepository(root).read(tree);
	const blobs = new Map((await tree.list()).map((entry) => [entry.path, entry.hash]));
	const ledger = (await new BudgetLedgerRepository(root).read(tree)).events;
	const limits = new BudgetService().baselines(ledger, units.manifests);
	const registry = revisionRegistry(units.manifests, scenarios.manifests, blobs, limits);
	await unitMetadata(tree, registry.units);
	const stored = {
		registry,
		ledger,
		platforms: await readPlatformCatalog(tree),
		projectDependencies: await projectDependencies(tree),
		translations: await translationCatalog(tree, registry.units)
	};
	kept.registries.set(key, stored);
	return stored;
}
/** Reasons of this commit itself, excluding the earlier commits of a verified range. */
export async function revisionReasonsAt(
	commit: string,
	sound: VerificationRecord[],
	kept: RevisionSources,
	history: HistoryStatusService
) {
	const note = (await history.all()).get(commit);
	const noted = (note?.entries ?? []).flatMap((entry) =>
		entry.kind === 'reason' ? [entry.explanation] : []
	);
	const records = sound.map((record) => ({
		base: record.source.base,
		entries: record.reasons.entries ?? []
	}));
	const parent = (await kept.source.parent(commit)) ?? null;
	return revisionReasons({ parent, own: await kept.source.reasons(commit), noted, records });
}
