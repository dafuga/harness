<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_ysl5rsdgp5 -->
<script lang="ts">
	import AudioIcon from '../verification-evidence/AudioIcon.svelte';
	import { onMount } from 'svelte';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { formatDuration } from '../../helpers/strings/formatDuration';
	import { t } from '../../utils/reports-media/reportLocale';
	import Status from '../shared-primitives/status/Status.svelte';
	let { before, after, onopen }: { before: Evidence; after: Evidence; onopen: () => void } =
		$props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	// The Before summary keeps the original's gallery anchor, so existing deep links still land here.
	let phases = $derived([
		{ item: before, phase: 'before', anchor: 'evidence-' + before.id },
		{ item: after, phase: 'after', anchor: undefined }
	]);
	let summaryId = $derived('audio-comparison-' + after.id);
	function unavailable(item: Evidence) {
		return Boolean(item.missing || !item.file);
	}
	function seconds(item: Evidence) {
		const value = item.durationSeconds;
		return value && Number.isFinite(value) && value > 0 ? value : null;
	}
</script>

<!-- One gallery card; each original keeps its own status and the pair never gets a combined one. -->
<hx-article class="evidence-card audio-comparison-card" id={'evidence-' + after.id}>
	<hx-button
		class="audio-comparison-preview"
		disabled={!ready}
		onclick={onopen}
		aria-label={$t('openAudioComparison', { values: { title: after.title } })}
		aria-describedby={summaryId}
	>
		<hx-span class="audio-identity">
			<AudioIcon />
			<hx-span class="audio-kind">{$t('audio')} · {$t('pairedRecordings')}</hx-span>
		</hx-span>
		<hx-span class="audio-comparison-phases" id={summaryId}>
			{#each phases as { item, phase, anchor } (phase)}
				{@const length = seconds(item)}
				<hx-span class="audio-comparison-row" id={anchor}>
					<hx-span class={'audio-comparison-phase ' + phase}>{$t(phase)}</hx-span>
					{#if unavailable(item)}<hx-span class="audio-comparison-missing"
							>{$t('audioUnavailable')}</hx-span
						>
					{:else if length}<hx-time class="audio-duration" datetime={`PT${Math.round(length)}S`}
							>{formatDuration(length)}</hx-time
						>{/if}
					<Status variant="badge" status={unavailable(item) ? 'not-proven' : item.status} />
				</hx-span>
			{/each}
		</hx-span>
		<hx-span class="audio-comparison-open">↗ {$t('listenAndCompare')}</hx-span>
	</hx-button>
	<hx-div class="card-body">
		<hx-div class="card-kicker"><hx-span>{after.category}</hx-span></hx-div>
		<hx-h3><hx-a href={'#evidence-' + after.id}>{after.title}</hx-a></hx-h3>
	</hx-div>
</hx-article>
