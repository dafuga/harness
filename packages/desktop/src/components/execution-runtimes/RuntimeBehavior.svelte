<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { behaviorDuration, entityBehavior } from '../../../../reports/src/utils/entityBehavior';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
	import RuntimeRun from './RuntimeRun.svelte';
	let {
		result,
		evidence,
		unit
	}: {
		result: EntityEvidenceResult;
		evidence: EntityEvidence;
		/** The function the results are shown for, when they are shown as its rows. */
		unit?: string;
	} = $props();
	const short = (commit: string) => commit.slice(0, 7);
	const behavior = $derived(result.behavior);
	/** Undefined while the results are being read; null when reading them failed. */
	const known = $derived(evidence.read);
	const reading = $derived(known === undefined && behavior.rows.length > 0);
	/** What the results come to is concluded by the reports explorer, before and after reading. */
	const shown = $derived(entityBehavior(known ?? behavior));
	/** A first commit is one run: it has no parent to stand beside. */
	const paired = $derived(shown.mode === 'commit' && result.scope.parent !== null);
	const at = $derived(short(result.scope.commit));
	/** One run, or unknown for a stated reason, stands without reading anything. */
	const fixed = $derived(
		behavior.summary === 'not-compared' ||
			(behavior.summary === 'unknown' && behavior.reason !== null)
	);
	/** Bytes that differ are no change yet: nothing else is said before both were read. */
	const pending = $derived(reading && !fixed);
	const label = $derived.by(() => {
		if (pending) return 'Reading the recorded results…';
		return known === null ? 'Behavior unknown' : shown.label;
	});
	const why = $derived(
		known === null ? 'The recorded results could not be read.' : shown.reasons.join('; ')
	);
	const duration = $derived(
		behaviorDuration(
			result.evidence.after.record,
			shown.scenarios.map((item) => item.id)
		)
	);
</script>

<hx-div class="runtime-card">
	<hx-h3>{paired ? 'End-to-end comparison' : 'Current end-to-end behavior'}</hx-h3>
	<hx-p class="muted">
		{paired
			? 'The same scenario and the same states at the parent and at the commit.'
			: `What the end-to-end checks recorded at ${at}.`}
	</hx-p>
	<hx-p class="runtime-verdict">
		<hx-strong role="status">{label}</hx-strong>{#if why}<hx-span>{why}</hx-span>{/if}
	</hx-p>
	{#if shown.groups.length === 0}<hx-p class="empty">
			No end-to-end result is recorded for this entity at {at}.
		</hx-p>{:else}<hx-div class="runtime-panes" class:paired>
			{#if paired}<RuntimeRun
					{shown}
					side="before"
					title={`Before · ${short(result.scope.parent ?? '')}`}
					role="Parent commit"
					lost={known === null}
					refusals={evidence.refusals}
					{unit}
				/>{/if}<RuntimeRun
				{shown}
				side="after"
				title={paired ? `After · ${at}` : `Current snapshot · ${at}`}
				role={paired ? 'Selected commit' : 'Branch tip'}
				lost={known === null}
				refusals={evidence.refusals}
				{unit}
			/>
		</hx-div>{/if}
	<hx-dl class="runtime-facts">
		<hx-dt>End-to-end duration</hx-dt>
		<hx-dd>{duration ?? 'Not measured'}</hx-dd>
		{#each shown.scenarios as scenario (scenario.id)}<hx-dt>{scenario.title}</hx-dt>
			<hx-dd>
				{paired ? `${scenario.before ?? 'not run'} → ` : ''}{scenario.after ?? 'not run'}
			</hx-dd>{/each}
	</hx-dl>
</hx-div>
