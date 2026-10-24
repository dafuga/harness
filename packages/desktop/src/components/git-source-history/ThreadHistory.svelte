<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import ImageThumbnail from '../shared-primitives/ImageThumbnail.svelte';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import type { DesignVersion, EntityDetail } from '../../models/development-tooling/Desktop.types';
	import { designOption, optionImages } from '../../utils/explorer-ui/threadAnchor';
	let {
		entity,
		workspace,
		version,
		option = '',
		select
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		version: string;
		/** The design option in view: its image stands for the version shown. */
		option?: string;
		select: (version: string) => void;
	} = $props();
	/** A function has plans and no design: no picture of a version is asked for. */
	const headless = $derived(entity.category === 'functions');
	/** The version in view shows the option shown; another its approved or first option. */
	function thumbnail(item: DesignVersion) {
		return optionImages(item, item.version === version ? option : designOption(item))[0];
	}
	/** An approval of one option names that option; it never stands for the whole version. */
	function approvedLabel(item: DesignVersion) {
		const index = item.options?.findIndex((choice) => choice.id === item.approval?.option) ?? -1;
		return index >= 0 ? `Option ${index + 1} approved` : 'Approved';
	}
</script>

<hx-details class="thread-history">
	<hx-summary>{entity.kind} history</hx-summary
	>{#each entity.history as event (event.id)}<hx-article>
			<hx-strong>{event.title}</hx-strong><hx-small>{event.at}</hx-small>
			<hx-p>{event.detail}</hx-p>
		</hx-article>{:else}<hx-p class="muted">No entity history recorded.</hx-p>{/each}
</hx-details>
<hx-div class="version-strip" aria-label="Entity image versions">
	{#each entity.versions as item (item.version)}<hx-button
			class:active={version === item.version}
			onclick={() => select(item.version)}
			>{#if thumbnail(item) && !headless}<ImageThumbnail
					{workspace}
					entityId={entity.id}
					version={item.version}
					sha256={thumbnail(item)!.sha256}
					title={`${entity.title} ${item.version}`}
				/>{/if}{item.version}<hx-small
				>{item.approval ? approvedLabel(item) : headless ? 'Plan' : 'Design'}</hx-small
			></hx-button
		>{/each}
</hx-div>
