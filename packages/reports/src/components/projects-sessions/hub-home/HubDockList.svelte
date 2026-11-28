<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_dk8n3wvb5c -->
<!-- @harness-uid u_4kou66r7hb -->
<script lang="ts">
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import { dockWait } from './hubDockModel';
	import type { HubDockModel } from './hubDockModel.types';
	import { initials } from './hubHomePresentation';

	let {
		model,
		now,
		pick
	}: { model: HubDockModel; now: number; pick: (agentId: string) => void } = $props();
</script>

<hx-div class="hd-body">
	{#if model.asking.length}
		<hx-section class="hd-group" data-tone="needs-you" aria-labelledby="hd-asking">
			<hx-h3 class="hd-kicker" id="hd-asking"
				><hx-span class="hd-diamond" aria-hidden="true"></hx-span>Have a question for you</hx-h3
			>
			<hx-ul class="hd-asks">
				{#each model.asking as { agent, line, since } (agent.id)}
					<hx-li>
						<hx-button type="button" class="hd-row hd-row-asks" onclick={() => pick(agent.id)}>
							<hx-span class="hd-avatar" data-state="needs-you" aria-hidden="true"
								>{initials(agent.name)}</hx-span
							>
							<hx-span class="hd-text">
								<hx-span class="hd-line">
									<hx-span class="hd-name">{agent.name}</hx-span>
									<hx-span class="hd-wait">waiting {dockWait(since, now)}</hx-span>
								</hx-span>
								<hx-span class="hd-meta" title={line}>{line}</hx-span>
							</hx-span>
							<hx-span class="hd-go" aria-hidden="true">›</hx-span>
						</hx-button>
					</hx-li>
				{/each}
			</hx-ul>
		</hx-section>
	{/if}
	<hx-section class="hd-group" aria-labelledby="hd-working">
		<hx-h3 class="hd-kicker" id="hd-working">Working</hx-h3>
		{#if model.working.length}
			<hx-ul class="hd-rows">
				{#each model.working as { agent, line } (agent.id)}
					<hx-li>
						<hx-button type="button" class="hd-row" onclick={() => pick(agent.id)}>
							<hx-span class="hd-avatar" data-state="working" aria-hidden="true"
								>{initials(agent.name)}</hx-span
							>
							<hx-span class="hd-text">
								<hx-span class="hd-name">{agent.name}</hx-span>
								<hx-span class="hd-meta" title={line}>{line}</hx-span>
							</hx-span>
							<Pill tone="hh-tone po-state po-active" state="active"
								><hx-span class="po-mark" aria-hidden="true"></hx-span>Working</Pill
							>
						</hx-button>
					</hx-li>
				{/each}
			</hx-ul>
		{:else}
			<hx-p class="hd-meta">Nothing running</hx-p>
		{/if}
	</hx-section>
</hx-div>
