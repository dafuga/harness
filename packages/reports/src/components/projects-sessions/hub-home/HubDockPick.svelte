<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_dk2p9xhf6e -->
<!-- @harness-uid u_vjh5jcsguz -->
<script lang="ts">
	import type { HomeAgent } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { agentLabels, initials } from './hubHomePresentation';

	let { agents, pick }: { agents: HomeAgent[]; pick: (agentId: string) => void } = $props();
</script>

<hx-div class="hd-body">
	<hx-ul class="hd-rows">
		{#each agents as agent (agent.id)}
			<hx-li>
				<hx-button type="button" class="hd-row" onclick={() => pick(agent.id)}>
					<hx-span class="hd-avatar" data-state={agent.state} aria-hidden="true"
						>{initials(agent.name)}</hx-span
					>
					<hx-span class="hd-text">
						<hx-span class="hd-name">{agent.name}</hx-span>
						<hx-span class="hd-meta">{agentLabels[agent.state]}</hx-span>
					</hx-span>
					<hx-span class="hd-go" aria-hidden="true">›</hx-span>
				</hx-button>
			</hx-li>
		{/each}
	</hx-ul>
</hx-div>
