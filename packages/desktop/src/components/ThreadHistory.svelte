<script lang="ts">
	import ImageThumbnail from './ImageThumbnail.svelte';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import type { DesignVersion, EntityDetail } from '../models/Desktop.types';
	import { designOption, optionImages } from '../utils/threadAnchor';
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

<details class="thread-history">
	<summary>{entity.kind} history</summary>{#each entity.history as event (event.id)}<article>
			<strong>{event.title}</strong><small>{event.at}</small>
			<p>{event.detail}</p>
		</article>{:else}<p class="muted">No entity history recorded.</p>{/each}
</details>
<div class="version-strip" aria-label="Entity image versions">
	{#each entity.versions as item (item.version)}<button
			class:active={version === item.version}
			onclick={() => select(item.version)}
			>{#if thumbnail(item) && !headless}<ImageThumbnail
					{workspace}
					entityId={entity.id}
					version={item.version}
					sha256={thumbnail(item)!.sha256}
					title={`${entity.title} ${item.version}`}
				/>{/if}{item.version}<small
				>{item.approval ? approvedLabel(item) : headless ? 'Plan' : 'Design'}</small
			></button
		>{/each}
</div>
