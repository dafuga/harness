import { entities, entity } from './explorerData';
import type { PreviewCases } from './shared';
import { usageLinkVariant } from './reportUsageLinkVariants';
import type { EntityLens } from '../../../../src/utils/entityLens';

/** Different consumer counts and limits exercise the same real footer component. */
export function explorerUsageVariant(props: PreviewCases[string], variant: string) {
	if (variant === 'usage-open') return openUsage(props);
	if (variant === 'empty') return { ...props, consumers: [] };
	if (variant === 'duplicates') return { ...props, consumers: [entity, entity] };
	const consumers = entities.slice(0, 4);
	if (variant === 'many') return { ...props, consumers };
	if (variant === 'limited') return { ...props, consumers, limit: 1 };
	if (variant === 'limit-zero') return { ...props, consumers, limit: 0 };
	return null;
}

/** A plausible synthetic revision replaces placeholder repeated characters in the provenance label. */
function openUsage(props: PreviewCases[string]) {
	const shown = usageLinkVariant(props, 'visual-open')!;
	const lens = shown.lens as EntityLens;
	const evidence = lens.evidence(entity.unit);
	const commit = '7c4a8d09e1b2f6a35d08c94716fe2b809ab6c5d48';
	const after = {
		...evidence.after,
		commit,
		detail: evidence.after.detail && { ...evidence.after.detail, commit },
		record: evidence.after.record && {
			...evidence.after.record,
			source: { ...evidence.after.record.source, commit },
			scenarios: evidence.after.record.scenarios.map((scenario) => ({
				...scenario,
				testedRevision: commit
			}))
		},
		captures: evidence.after.captures.map((found) => ({
			...found,
			capture: {
				...found.capture,
				server: found.capture.server && { ...found.capture.server, revision: commit }
			}
		}))
	};
	return { ...shown, lens: { ...lens, evidence: () => ({ ...evidence, after }) } };
}
