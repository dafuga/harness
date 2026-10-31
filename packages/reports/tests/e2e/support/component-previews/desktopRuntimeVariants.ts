import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';

export function desktopRuntimeVariant(
	id: string,
	props: PreviewProps,
	data: DesktopData,
	variant: string
): PreviewProps | null {
	if (id === 'desktop.component.runtime-artifact') return artifact(props, data, variant);
	if (id === 'desktop.component.status-icon') {
		const changes: Record<string, PreviewProps> = {
			failed: { status: 'failed' },
			unverified: { status: 'unverified' },
			unknown: { status: 'unknown' },
			'no-reason': { status: 'unknown', reason: '' },
			long: {
				status: 'failed',
				reason: 'A required state has no capture at this revision. '.repeat(8)
			}
		};
		return { ...props, ...changes[variant] };
	}
	if (id === 'desktop.component.runtime-screens' && variant === 'empty') {
		const result = data.visual;
		const evidence = {
			...result.evidence,
			scenarios: [],
			after: { ...result.evidence.after, captures: [] }
		};
		return { ...props, options: [], result: { ...result, evidence } };
	}
	if (id === 'desktop.component.runtime-behavior' && variant === 'empty')
		return {
			...props,
			result: { ...data.result, behavior: { ...data.result.behavior, rows: [] } }
		};
	return id.includes('.runtime-') ? props : null;
}
function artifact(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	const cell = data.cell;
	const changes: Record<string, PreviewProps> = {
		missing: { cell: { ...cell, capture: null } },
		unstored: {
			cell: {
				...cell,
				capture: { ...cell.capture, media: null, gap: 'The original bytes were not retained.' }
			}
		},
		loading: { cell: { ...cell, read: undefined }, lost: false },
		unreadable: {
			cell: {
				...cell,
				read: { ...cell.read, verified: false, problem: 'Synthetic artifact hash mismatch.' }
			},
			lost: true
		},
		text: {
			cell: {
				...cell,
				read: {
					...cell.read,
					verified: true,
					document: null,
					text: 'Recorded plain text output.\n'.repeat(30)
				}
			}
		}
	};
	return { ...props, ...changes[variant] };
}
/** Apply store states after the normal fixture reads settle, before mounting the component. */
export async function desktopRuntimeReady(id: string, data: DesktopData, variant: string) {
	await data.ready;
	if (id === 'desktop.component.runtime-behavior') {
		if (variant === 'loading') data.evidence.read = undefined;
		if (variant === 'unreadable') data.evidence.read = null;
		if (variant === 'empty') data.evidence.read = { ...data.result.behavior, rows: [] };
	}
	prepareScreens(id, data, variant);
	if (id !== 'desktop.component.runtime-evidence') return;
	prepareEvidence(data, variant);
}

function prepareScreens(id: string, data: DesktopData, variant: string) {
	if (id === 'desktop.component.runtime-screens' && ['paired', 'incomparable'].includes(variant)) {
		data.visual.evidence.mode = 'commit';
		if (variant === 'incomparable')
			data.visual.evidence.incomparable = [
				'The two captures were recorded with different runtime profiles.'
			];
	}
}

function prepareEvidence(data: DesktopData, variant: string) {
	const statuses = {
		planned: 'planned',
		unavailable: 'unavailable',
		loading: 'loading',
		error: 'failed'
	} as const;
	if (variant in statuses) data.visualEvidence.status = statuses[variant as keyof typeof statuses];
	if (variant === 'error') data.visualEvidence.error = 'Synthetic evidence read refused.';
	if (variant === 'offline') data.workspace.offline = { cachedAt: '2026-10-20T09:00:00Z' };
}
