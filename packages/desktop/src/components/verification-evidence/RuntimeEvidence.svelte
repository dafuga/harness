<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import Pill from '$shared/explorer-ui/explorer-kit/Pill.svelte';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import { screenOptions } from '$reports/utils/explorer-ui/entityScreens';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { EntityDetail } from '../../models/development-tooling/Desktop.types';
	import { evidenceNotice } from '../../utils/verification-evidence/evidenceNotice';
	import { timeLabel } from '../../utils/development-tooling/timeLabel';
	import RuntimeAudio from '../reports-media/RuntimeAudio.svelte';
	import RuntimeBehavior from '../execution-runtimes/RuntimeBehavior.svelte';
	import RuntimeScreens from '../execution-runtimes/RuntimeScreens.svelte';
	import RegressionProof from '$shared/verification-evidence/RegressionProof.svelte';
	let {
		entity,
		workspace,
		evidence
	}: { entity: EntityDetail; workspace: Workspace; evidence: EntityEvidence } = $props();
	const result = $derived(evidence.status === 'ready' ? evidence.result : null);
	const notice = $derived(evidenceNotice(evidence.status, evidence.error, entity.kind));
	/** A page or a component is seen; anything else is known by what it did. */
	const visual = $derived(['pages', 'layouts', 'components'].includes(entity.category));
	/** A function is shown by the rows its tests recorded, and never by a picture of a run. */
	const headless = $derived(entity.category === 'functions');
	const options = $derived(result ? screenOptions(result.evidence.scenarios) : []);
	const where = $derived.by(() => {
		if (!result) return '';
		const { mode, commit, parent } = result.scope;
		if (mode === 'current') return `Branch tip · ${shortCommit(commit)}`;
		return parent
			? `Commit ${shortCommit(commit)} beside its parent ${shortCommit(parent)}`
			: `Commit ${shortCommit(commit)} · first commit`;
	});
	const saved = $derived(
		workspace.offline?.cachedAt ? ` of ${timeLabel(workspace.offline.cachedAt)}` : ''
	);
</script>

<!-- What verification captured from running software; a planned design is never shown here. -->
<hx-section class="panel runtime-evidence" aria-label="Recorded runtime evidence">
	{#if result}<RegressionProof
			items={result.evidence.after.detail?.regressions ?? []}
			unit={entity.id}
			href={(commit) => workspace.link({ commit, category: entity.category, entityId: entity.id })}
			follow={(commit) =>
				void workspace.navigate(
					workspace.link({ commit, category: entity.category, entityId: entity.id })
				)}
		/>{/if}
	<hx-div class="row">
		<hx-h2>Recorded runtime evidence</hx-h2>
		<Pill as="span" variant="chip" tone="runtime-chip runtime-evidence-chip">Runtime capture</Pill
		>{#if where}<hx-small>{where}</hx-small>{/if}
	</hx-div>
	{#if workspace.offline}<hx-p class="muted">
			Saved copy{saved}; not checked with the server.
		</hx-p>{/if}
	{#if notice}<Notice
			className={notice.alert ? 'error' : 'empty'}
			role={notice.alert ? 'alert' : 'status'}
		>
			{notice.text}
		</Notice>{:else if result}{#if !headless && (visual || options.length)}<RuntimeScreens
				{result}
				{options}
				{evidence}
			/>{/if}{#if !visual || result.behavior.rows.length}<RuntimeBehavior
				{result}
				{evidence}
				unit={headless ? entity.id : undefined}
			/>{/if}<RuntimeAudio {result} {evidence} />{/if}
</hx-section>
