import type { LedgerRead } from '../../../../repositories/BudgetLedgerRepository';
import type { VerificationStoreRepository } from '../../../../repositories/VerificationStoreRepository';
import type { ComponentManifest, ScenarioManifest } from '../../../../core/unitTypes';
import { previewBinding } from '../../../../utils/previewBinding';

interface Registry {
	/** Manifests exactly as stored at the revision. */
	stored: ComponentManifest[];
	scenarios?: ScenarioManifest[];
}

/** An identity may be retired but never deleted: history and baselines hang off it. */
export function registryGate(base: Registry, head: Registry): string[] {
	const kept = new Set(head.stored.map((unit) => unit.id));
	return [
		...base.stored
			.filter((unit) => !kept.has(unit.id))
			.map(
				(unit) => `unit ${unit.id} was removed from the registry; identities may only be retired`
			),
		...head.stored
			.filter((unit) => unit.status === 'active')
			.flatMap((unit) => previewBinding(unit, head.scenarios ?? []))
	];
}

/**
 * The ledger only grows, and every new line must cite a verification record that exists. A
 * rewritten line or an event without its record cannot raise or reset a limit.
 */
export function ledgerGate(
	ledger: { base: LedgerRead; head: LedgerRead },
	store: VerificationStoreRepository
): string[] {
	if (!ledger.head.text.startsWith(ledger.base.text)) {
		return ['budget ledger was rewritten; recorded baselines and approvals are append-only'];
	}
	const added = ledger.head.events.slice(ledger.base.events.length);
	const uncited = added.filter((event) => {
		const cited = store.load(event.record.id)?.record;
		return cited?.source.commit !== event.record.commit || cited.source.tree !== event.record.tree;
	});
	return [
		...ledger.head.errors,
		...uncited.map(
			(event) =>
				`budget ${event.type} for ${event.unit} cites record ${event.record.id.slice(0, 12)}, which is not available`
		)
	];
}
