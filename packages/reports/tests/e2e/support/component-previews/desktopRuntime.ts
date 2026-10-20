import type { DesktopCase } from './desktopData.svelte';
export const desktopRuntime: Record<string, DesktopCase> = {
	'desktop.component.runtime-artifact': (d) => ({
		cell: d.cell,
		label: 'Recorded filter call',
		lost: false
	}),
	'desktop.component.runtime-audio': (d) => ({ result: d.audioResult, evidence: d.audioEvidence }),
	'desktop.component.runtime-behavior': (d) => ({ result: d.result, evidence: d.evidence }),
	'desktop.component.runtime-evidence': (d) => ({
		entity: d.visualEntity,
		workspace: d.workspace,
		evidence: d.visualEvidence
	}),
	'desktop.component.runtime-pane': (d) => ({
		item: d.item,
		title: 'Current screenshot',
		role: 'Branch tip',
		evidence: d.visualEvidence
	}),
	'desktop.component.runtime-run': (d) => ({
		shown: d.shown,
		side: 'after',
		title: 'Current results',
		role: 'Branch tip',
		lost: false,
		refusals: {}
	}),
	'desktop.component.runtime-screens': (d) => ({
		result: d.visual,
		options: d.options,
		evidence: d.visualEvidence
	})
};
