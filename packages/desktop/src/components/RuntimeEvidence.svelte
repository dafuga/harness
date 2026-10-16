<script lang="ts">
	import { screenOptions } from '../../../reports/src/utils/entityScreens';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { EntityDetail } from '../models/Desktop.types';
	import { evidenceNotice } from '../utils/evidenceNotice';
	import { timeLabel } from '../utils/timeLabel';
	import RuntimeAudio from './RuntimeAudio.svelte';
	import RuntimeBehavior from './RuntimeBehavior.svelte';
	import RuntimeScreens from './RuntimeScreens.svelte';
	let {
		entity,
		workspace,
		evidence
	}: { entity: EntityDetail; workspace: Workspace; evidence: EntityEvidence } = $props();
	const short = (commit: string) => commit.slice(0, 7);
	const result = $derived(evidence.status === 'ready' ? evidence.result : null);
	const notice = $derived(evidenceNotice(evidence.status, evidence.error, entity.kind));
	/** A page or a component is seen; anything else is known by what it did. */
	const visual = $derived(['pages', 'shells', 'components'].includes(entity.category));
	/** A function is shown by the rows its tests recorded, and never by a picture of a run. */
	const headless = $derived(entity.category === 'functions');
	const options = $derived(result ? screenOptions(result.evidence.scenarios) : []);
	const where = $derived.by(() => {
		if (!result) return '';
		const { mode, commit, parent } = result.scope;
		if (mode === 'current') return `Branch tip · ${short(commit)}`;
		return parent
			? `Commit ${short(commit)} beside its parent ${short(parent)}`
			: `Commit ${short(commit)} · first commit`;
	});
	const saved = $derived(
		workspace.offline?.cachedAt ? ` of ${timeLabel(workspace.offline.cachedAt)}` : ''
	);
</script>

<!-- What verification captured from running software; a planned design is never shown here. -->
<section class="panel runtime-evidence" aria-label="Recorded runtime evidence">
	<div class="row">
		<h2>Recorded runtime evidence</h2>
		<span class="chip runtime-chip">Runtime capture</span>{#if where}<small>{where}</small>{/if}
	</div>
	{#if workspace.offline}<p class="muted">
			Saved copy{saved}; not checked with the server.
		</p>{/if}
	{#if notice}<p class={notice.alert ? 'error' : 'empty'} role={notice.alert ? 'alert' : 'status'}>
			{notice.text}
		</p>{:else if result}{#if !headless && (visual || options.length)}<RuntimeScreens
				{result}
				{options}
				{evidence}
			/>{/if}{#if !visual || result.behavior.rows.length}<RuntimeBehavior
				{result}
				{evidence}
				unit={headless ? entity.id : undefined}
			/>{/if}<RuntimeAudio {result} {evidence} />{/if}
</section>
