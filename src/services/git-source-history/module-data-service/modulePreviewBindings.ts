import { explorerCategory } from '../../../../packages/reports/src/utils/explorer-ui/explorerCategory';
import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
/** Materialize an unambiguous declared preview; unknown or competing states remain missing. */
export function modulePreviewBindings(
	registry: RevisionRegistry,
	declarations: ComponentManifest[]
): void {
	const manifests = new Map(declarations.map((unit) => [unit.id, unit]));
	for (const unit of registry.units) {
		if (unit.preview || unit.status !== 'active') continue;
		if (!['pages', 'layouts', 'components'].includes(explorerCategory(unit) ?? '')) continue;
		const picks = previewCandidates(registry, unit.id);
		const canonical = picks.find(
			(pick) =>
				pick.scenario === 'component-catalog-previews' &&
				pick.state === unit.id.replace(/[.]/g, '-')
		);
		const unique = picks.length === 1 ? picks[0] : undefined;
		const pick = canonical ?? unique;
		if (!pick) continue;
		unit.preview = pick;
		const manifest = manifests.get(unit.id);
		if (manifest) manifest.preview = pick;
	}
}

function previewCandidates(registry: RevisionRegistry, id: string) {
	return registry.scenarios.flatMap((scenario) =>
		scenario.states.flatMap((state) => {
			if (state.coverage !== 'required' || state.units?.length !== 1 || state.units[0] !== id)
				return [];
			const slots = scenario.evidence.filter(
				(item) =>
					item.kind === 'screenshot' && item.required !== false && item.states.includes(state.id)
			);
			const viewport =
				slots.flatMap((item) => item.viewports).find((id) => id === 'desktop') ??
				slots[0]?.viewports[0];
			return viewport ? [{ scenario: scenario.id, state: state.id, viewport }] : [];
		})
	);
}
