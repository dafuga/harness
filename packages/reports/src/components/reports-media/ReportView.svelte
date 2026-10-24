<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Detail } from './ReportView.types';

	import BrandMark from '../shared-primitives/BrandMark.svelte';
	import { tick } from 'svelte';
	import type { Report } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import ReportSummary from './report-summary/ReportSummary.svelte';
	import GameplayReplay from './gameplay-replay/GameplayReplay.svelte';
	import ReportChecks from '../verification-evidence/ReportChecks.svelte';
	import ReportFindings from './ReportFindings.svelte';
	import CoverageList from '../shared-primitives/CoverageList.svelte';
	import EvidenceGrid from '../verification-evidence/evidence-grid/EvidenceGrid.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
	let {
		report,
		assetBase,
		downloadBase,
		portable = false,
		onUploaded
	}: {
		report: Report;
		assetBase: string;
		downloadBase: string;
		portable?: boolean;
		onUploaded?: (report: Report) => void;
	} = $props();
	let activeDetail = $state<Detail | null>(null);
	let opener: HTMLButtonElement | null = null;
	function openDetail(detail: Detail, event: MouseEvent) {
		opener = event.currentTarget as HTMLButtonElement;
		activeDetail = detail;
	}
	async function closeDetail() {
		activeDetail = null;
		await tick();
		opener?.focus();
	}
	let detailTitle = $derived(activeDetail ? $t(activeDetail) : '');
</script>

<hx-main class="report-shell">
	<hx-nav class="topbar">
		<hx-a class="brand" href={portable ? '#' : '/harness/reports'}
			><hx-span class="brand-symbol"><BrandMark /></hx-span> {$t('hub')}</hx-a
		>
		<hx-span class="workspace-label">{$t(portable ? 'html' : 'local')}</hx-span>
	</hx-nav>
	{#if !portable}<hx-a class="back-link" href={'/harness/reports?project=' + report.project.id}
			>← {$t('history')}</hx-a
		>{/if}
	<ReportSummary {report} {downloadBase} {portable} />
	<ReportFindings findings={report.findings} />
	<hx-section class="review-launch" aria-label={$t('reviewDetails')}>
		<hx-button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('checks')}, ${report.checks.length} checks`}
			onclick={(event) => openDetail('checks', event)}
		>
			<hx-span>{$t('checks')}</hx-span><hx-span class="review-launch-count" aria-hidden="true"
				>{report.checks.length} <hx-span>↗</hx-span></hx-span
			>
		</hx-button>
		<hx-button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('acceptance')}, ${report.acceptance.length} criteria`}
			onclick={(event) => openDetail('acceptance', event)}
		>
			<hx-span>{$t('acceptance')}</hx-span><hx-span class="review-launch-count" aria-hidden="true"
				>{report.acceptance.length} <hx-span>↗</hx-span></hx-span
			>
		</hx-button>
		<hx-button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('coverage')}, ${report.coverage.length} workflows`}
			onclick={(event) => openDetail('coverage', event)}
		>
			<hx-span>{$t('coverage')}</hx-span><hx-span class="review-launch-count" aria-hidden="true"
				>{report.coverage.length} <hx-span>↗</hx-span></hx-span
			>
		</hx-button>
	</hx-section>
	<Modal open={activeDetail !== null} title={detailTitle} variant="text" onClose={closeDetail}>
		{#if activeDetail === 'checks'}<ReportChecks checks={report.checks} embedded />
		{:else if activeDetail === 'acceptance'}<CoverageList {report} section="acceptance" embedded />
		{:else if activeDetail === 'coverage'}<CoverageList {report} section="coverage" embedded />{/if}
	</Modal>
	<EvidenceGrid
		items={report.evidence}
		{assetBase}
		reportId={report.state === 'active' && !portable ? report.id : undefined}
		{onUploaded}
	/>
	<GameplayReplay {report} {assetBase} {portable} />
	<hx-footer class="report-footer"
		><hx-span>{$t(report.state)}</hx-span><hx-span>{report.id}</hx-span></hx-footer
	>
</hx-main>
