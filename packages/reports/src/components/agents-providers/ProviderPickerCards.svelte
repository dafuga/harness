<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { SessionObservation, SwitchRequest } from '../../../../../src/core/pickerTypes';
	import type { PickerModel, ProviderSelection } from '../../../../../src/core/pickerModelTypes';
	let {
		active,
		request,
		models,
		providers,
		locked,
		oncancel
	}: {
		active: SessionObservation | null;
		request: SwitchRequest | null;
		models: PickerModel[];
		providers: Record<string, string>;
		locked: boolean;
		oncancel: () => void;
	} = $props();
	function labelFor(target: ProviderSelection): string {
		return (
			models.find((item) => item.provider === target.provider && item.model === target.model)
				?.label ?? target.model
		);
	}
	function when(iso: string): string {
		return Date.parse(iso)
			? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
			: iso;
	}
</script>

{#snippet choice(target: ProviderSelection)}
	<hx-strong>{labelFor(target)}</hx-strong>
	<hx-p
		>{providers[target.provider] ?? target.provider} · {target.model} · {target.effort} effort</hx-p
	>
{/snippet}

<hx-div class="picker-cards">
	<hx-article class="picker-card picker-active">
		<hx-h3>Active model</hx-h3>
		{#if active}
			{@render choice(active.selection)}
			<hx-p>
				{active.idle ? 'Idle' : 'In use'} · clients: {active.clients} · observed {when(
					active.observedAt
				)}
			</hx-p>
		{:else}
			<hx-strong>Unknown</hx-strong>
			<hx-p>No verified observation of this session yet.</hx-p>
		{/if}
	</hx-article>
	<hx-article class="picker-card picker-request" data-status={request?.status}>
		<hx-h3>
			Requested switch <hx-span class="picker-status"
				>{request ? request.status[0].toUpperCase() + request.status.slice(1) : 'None'}</hx-span
			>
		</hx-h3>
		{#if request}
			{@render choice(request.target)}
			<hx-p>Queued {when(request.createdAt)}{request.reason ? ` · ${request.reason}` : ''}</hx-p>
		{:else}
			<hx-p>Nothing is queued for this session.</hx-p>
		{/if}
		{#if request?.status === 'pending'}
			<hx-button type="button" onclick={oncancel} disabled={locked}>Cancel pending switch</hx-button
			>
		{/if}
	</hx-article>
</hx-div>
