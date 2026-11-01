import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import { desktopArtifactText, desktopData } from './desktopFixtureData';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

export function desktopRuntimeVariant(
	id: string,
	props: PreviewProps,
	data: DesktopData,
	variant: string
): PreviewProps | null {
	if (id === 'desktop.component.runtime-artifact') return artifact(props, data, variant);
	if (id === 'desktop.component.runtime-behavior') return behavior(props, data, variant);
	if (id === 'desktop.component.status-icon') {
		const changes: Record<string, PreviewProps> = {
			failed: {
				status: 'failed',
				reason:
					'Verification failed: the component test did not finish successfully at this revision.'
			},
			unverified: {
				status: 'unverified',
				reason: 'This revision has not been verified. Run the required checks before accepting it.'
			},
			unknown: {
				status: 'unknown',
				reason: 'Verification status is unknown: the saved record could not be read or trusted.'
			},
			'no-reason': { status: 'unknown', reason: '' },
			long: {
				status: 'failed',
				reason:
					'The desktop capture passed, but tablet and mobile captures are missing for this revision. Their earlier images predate the current source change and cannot verify this build. Rerun the component catalog at both viewports, retain the original images in history, and inspect them before accepting this revision.'
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
	return id.includes('.runtime-') ? props : null;
}

function behavior(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	const result = ['loading', 'paired'].includes(variant)
		? desktopData.results[`${data.filterEntity.id}|commit|${commits.tip}`]
		: data.result;
	if (variant === 'empty')
		return { ...props, result: { ...result, behavior: { ...result.behavior, rows: [] } } };
	if (variant === 'paired') return { ...props, result };
	if (!['loading', 'unreadable'].includes(variant)) return props;
	return {
		...props,
		result: {
			...result,
			behavior: {
				...result.behavior,
				rows: result.behavior.rows.map((row) => ({
					...row,
					beforeRead: undefined,
					afterRead: undefined
				}))
			}
		}
	};
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
				read: {
					...cell.read,
					verified: false,
					problem: 'The artifact bytes do not match the recorded hash.'
				}
			},
			lost: true
		},
		text: {
			cell: {
				...cell,
				...desktopArtifactText
			}
		}
	};
	return { ...props, ...changes[variant] };
}
/** Apply store states after the normal fixture reads settle, before mounting the component. */
export async function desktopRuntimeReady(id: string, data: DesktopData, variant: string) {
	await data.ready;
	if (id === 'desktop.component.runtime-behavior') {
		if (variant === 'paired')
			data.evidence.read =
				desktopData.results[`${data.filterEntity.id}|commit|${commits.tip}`].behavior;
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
	if (variant === 'error')
		data.visualEvidence.error = "Couldn't load recorded evidence. Try again.";
	if (variant === 'offline') data.workspace.offline = { cachedAt: '2026-10-20T09:00:00Z' };
}
