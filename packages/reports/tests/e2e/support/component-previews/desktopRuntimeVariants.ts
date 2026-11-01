import type { DesktopData } from './desktopData.svelte';
import { whenReady } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import { desktopArtifactText, desktopData } from './desktopFixtureData';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';
import { evidenceReading } from '../../../../../desktop/src/utils/verification-evidence/evidenceReading';
import { screenOptions } from '../../../../src/utils/entityScreens';

export function desktopRuntimeVariant(
	id: string,
	props: PreviewProps,
	data: DesktopData,
	variant: string
): PreviewProps | null {
	if (id === 'desktop.component.runtime-artifact') return artifact(props, data, variant);
	if (id === 'desktop.component.runtime-behavior') return behavior(props, data, variant);
	if (id === 'desktop.component.runtime-screens') return screens(props, data, variant);
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
					'The desktop capture passed, but tablet and mobile captures are missing for this revision. Their earlier images predate the current source change and cannot verify this build. Rerun the component catalog at every viewport, retain the original images in history, and inspect them before accepting this revision.'
			}
		};
		return { ...props, ...changes[variant] };
	}
	return id.includes('.runtime-') ? props : null;
}

function screens(props: PreviewProps, data: DesktopData, variant: string): PreviewProps {
	const entity = variant === 'paired' ? data.entity : data.visualEntity;
	const result = ['paired', 'incomparable'].includes(variant)
		? desktopData.results[`${entity.id}|commit|${commits.tip}`]
		: data.visual;
	const evidence = { ...result.evidence };
	if (variant === 'empty') {
		evidence.scenarios = [];
		evidence.after = { ...evidence.after, captures: [] };
	}
	return { ...props, options: screenOptions(evidence.scenarios), result: { ...result, evidence } };
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
		output: { cell: data.shown.groups[0].lines.find((line) => line.kind === 'output')!.after },
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
		if (variant === 'paired') {
			const result = desktopData.results[`${data.filterEntity.id}|commit|${commits.tip}`];
			const read = await evidenceReading(data.bridge, result, {
				entityId: data.filterEntity.id,
				projectId: data.workspace.projectId!,
				commit: commits.tip,
				branch: desktopData.branch,
				mode: 'commit'
			});
			data.evidence.read = read.behavior;
			data.evidence.refusals = read.refusals;
		}
		if (variant === 'loading') data.evidence.read = undefined;
		if (variant === 'unreadable') data.evidence.read = null;
		if (variant === 'empty') data.evidence.read = { ...data.result.behavior, rows: [] };
	}
	await prepareScreens(id, data, variant);
	if (id !== 'desktop.component.runtime-evidence') return;
	prepareEvidence(data, variant);
}

async function prepareScreens(id: string, data: DesktopData, variant: string) {
	if (id === 'desktop.component.runtime-screens' && ['paired', 'incomparable'].includes(variant)) {
		data.visualEvidence.show(data.bridge, {
			scope: {
				entityId: variant === 'paired' ? data.entity.id : data.visualEntity.id,
				projectId: data.workspace.projectId!,
				commit: commits.tip,
				branch: desktopData.branch,
				mode: 'commit'
			},
			planned: false,
			stamp: 'desktop-screens-comparison'
		});
		await whenReady(data.visualEvidence);
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
