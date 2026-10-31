import type { PreviewCases } from './shared';
import * as d from './explorerData';
import type { ExplorerEvidence } from '../../../../src/models/explorer-ui/Explorer.types';

export function artifactProps(props: PreviewCases[string], variant: string) {
	const cell = d.cell;
	if (variant === 'not-recorded') return { ...props, cell: { ...cell, capture: null } };
	if (variant === 'not-stored')
		return {
			...props,
			cell: {
				...cell,
				capture: { ...cell.capture, media: null, gap: 'Original bytes were not retained.' }
			}
		};
	if (variant === 'loading') return { ...props, cell: { ...cell, read: undefined } };
	if (variant === 'unverified')
		return {
			...props,
			cell: {
				...cell,
				read: {
					...cell.read,
					verified: false,
					problem: 'The stored bytes do not match the recorded hash.'
				}
			}
		};
	if (variant === 'lost') return { ...props, cell: { ...cell, read: undefined }, lost: true };
	if (variant === 'plain-text' || variant === 'long')
		return {
			...props,
			cell: {
				...cell,
				read: {
					...cell.read,
					document: null,
					text:
						variant === 'long'
							? 'Recorded result with complete source provenance.\n'.repeat(300)
							: 'The recorded command completed successfully.'
				}
			}
		};
	return props;
}

export function audioProps(props: PreviewCases[string], variant: string) {
	const evidence = d.audioEvidence;
	if (variant === 'empty')
		return {
			...props,
			evidence: { ...evidence, before: null, after: { ...evidence.after, captures: [] } },
			empty: true
		};
	const before = { ...evidence.after, commit: d.commits.first };
	const after = evidence.after;
	return {
		...props,
		evidence: {
			...evidence,
			mode: 'commit',
			before: variant === 'missing-before' ? { ...before, captures: [] } : before,
			after: variant === 'missing-after' ? { ...after, captures: [] } : after
		}
	};
}

export function behaviorProps(props: PreviewCases[string], variant: string) {
	const behavior = d.behavior;
	if (variant === 'empty')
		return {
			...props,
			behavior: { ...behavior, rows: [], scenarios: [] },
			read: { ...behavior, rows: [], scenarios: [] }
		};
	if (variant === 'current')
		return {
			...props,
			behavior: { ...behavior, mode: 'current', summary: 'not-compared' },
			read: { ...behavior, mode: 'current', summary: 'not-compared' },
			scope: { ...d.shown.scope, mode: 'current' }
		};
	if (variant === 'initial') return { ...props, scope: { ...d.shown.scope, parent: null } };
	if (variant === 'unknown')
		return {
			...props,
			read: { ...behavior, summary: 'unknown', reason: 'The parent result was not recorded.' }
		};
	if (variant === 'changed')
		return {
			...props,
			read: {
				...behavior,
				summary: 'changed',
				rows: behavior.rows.map((row) => ({
					...row,
					change: 'changed',
					differences: ['output.orders']
				}))
			}
		};
	if (variant === 'loading')
		return {
			...props,
			read: null,
			behavior: {
				...behavior,
				summary: 'unknown',
				reason: null,
				rows: behavior.rows.map((row) => ({ ...row, beforeRead: undefined, afterRead: undefined }))
			}
		};
	return { ...props, reasons: d.longReasons, duration: '1.2s' };
}

export function screenProps(props: PreviewCases[string], variant: string) {
	const evidence = props.evidence as ExplorerEvidence;
	if (variant === 'current')
		return { ...props, evidence: { ...evidence, mode: 'current', before: null } };
	if (variant === 'initial')
		return {
			...props,
			evidence: { ...evidence, before: null, initial: 'No parent exists for the initial commit.' },
			scope: { ...d.shown.scope, parent: null }
		};
	if (variant === 'missing')
		return {
			...props,
			evidence: {
				...evidence,
				after: { ...evidence.after, captures: [] },
				before: evidence.before && { ...evidence.before, captures: [] }
			}
		};
	if (variant === 'incomparable')
		return {
			...props,
			evidence: { ...evidence, incomparable: ['The viewport dimensions differ between revisions.'] }
		};
	return props;
}
