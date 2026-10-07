<script lang="ts">
	import { tick } from 'svelte';
	import type { Report } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import ReportSummary from './ReportSummary.svelte';
	import GameplayReplay from './GameplayReplay.svelte';
	import ReportChecks from './ReportChecks.svelte';
	import ReportFindings from './ReportFindings.svelte';
	import CoverageList from './CoverageList.svelte';
	import EvidenceGrid from './EvidenceGrid.svelte';
	import Modal from './Modal.svelte';
	let {
		report,
		assetBase,
		downloadBase,
		portable = false,
		onUploaded
	}: { report: Report; assetBase: string; downloadBase: string; portable?: boolean; onUploaded?: (report: Report) => void } = $props();
	type Detail = 'checks' | 'acceptance' | 'coverage';
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

<main class="report-shell">
	<nav class="topbar">
		<a class="brand" href={portable ? '#' : '/'}><span class="brand-symbol">◈</span> {$t('hub')}</a>
		<span class="workspace-label">{$t(portable ? 'html' : 'local')}</span>
	</nav>
	{#if !portable}<a class="back-link" href={'/?project=' + report.project.id}>← {$t('history')}</a
		>{/if}
	<ReportSummary {report} {downloadBase} {portable} />
	<GameplayReplay {report} {assetBase} {portable} />
	<ReportFindings findings={report.findings} />
	<section class="review-launch" aria-label={$t('reviewDetails')}>
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('checks')}, ${report.checks.length} checks`}
			onclick={(event) => openDetail('checks', event)}
		>
			<span>{$t('checks')}</span><span class="review-launch-count" aria-hidden="true"
				>{report.checks.length} <span>↗</span></span
			>
		</button>
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('acceptance')}, ${report.acceptance.length} criteria`}
			onclick={(event) => openDetail('acceptance', event)}
		>
			<span>{$t('acceptance')}</span><span class="review-launch-count" aria-hidden="true"
				>{report.acceptance.length} <span>↗</span></span
			>
		</button>
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label={`${$t('coverage')}, ${report.coverage.length} workflows`}
			onclick={(event) => openDetail('coverage', event)}
		>
			<span>{$t('coverage')}</span><span class="review-launch-count" aria-hidden="true"
				>{report.coverage.length} <span>↗</span></span
			>
		</button>
	</section>
	<Modal open={activeDetail !== null} title={detailTitle} variant="text" onClose={closeDetail}>
		{#if activeDetail === 'checks'}<ReportChecks checks={report.checks} embedded />
		{:else if activeDetail === 'acceptance'}<CoverageList {report} section="acceptance" embedded />
		{:else if activeDetail === 'coverage'}<CoverageList {report} section="coverage" embedded />{/if}
	</Modal>
	<EvidenceGrid items={report.evidence} {assetBase} reportId={report.state === 'active' && !portable ? report.id : undefined} {onUploaded} />
	<footer class="report-footer"><span>{$t(report.state)}</span><span>{report.id}</span></footer>
</main>
