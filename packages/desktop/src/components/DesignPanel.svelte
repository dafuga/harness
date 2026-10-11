<script lang="ts">
	import Select from '$shared/Select.svelte';
	import SegmentedChoice from './SegmentedChoice.svelte';
	import type { DesignVersion, EntityDetail, Region, ThreadInfo } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import AnnotatedImage from './AnnotatedImage.svelte';
	let {
		entity,
		workspace,
		version = $bindable(''),
		onthread
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		version?: string;
		onthread: (thread: ThreadInfo) => void;
	} = $props();
	let viewport = $state('desktop');
	let imageState = $state('default');
	let url = $state('');
	let error = $state('');
	const current = $derived(entity.versions.find((v) => v.version === version));
	const images = $derived(current?.images || []);
	const selected = $derived(images.find((i) => i.viewport === viewport && i.state === imageState));
	$effect(() => {
		if (!images.some((image) => image.viewport === viewport))
			viewport = images[0]?.viewport || 'desktop';
		const states = images.filter((image) => image.viewport === viewport);
		if (!states.some((image) => image.state === imageState))
			imageState = states[0]?.state || 'default';
	});
	const threads = $derived(
		entity.threads.filter((t) => t.version === version && t.imageSha256 === selected?.sha256)
	);
	$effect(() => {
		if (!entity.versions.some((v) => v.version === version))
			version = entity.versions.at(-1)?.version || '';
	});
	$effect(() => {
		let disposed = false;
		let objectUrl = '';
		url = '';
		error = '';
		if (selected && workspace.bridge && workspace.snapshot)
			void workspace.bridge
				.image({
					entityId: entity.id,
					commit: workspace.snapshot.revision.commit,
					version,
					sha256: selected.sha256
				})
				.then((bytes) => {
					objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
					if (!disposed) url = objectUrl;
					else URL.revokeObjectURL(objectUrl);
				})
				.catch((cause) => {
					if (!disposed) error = String(cause);
				});
		return () => {
			disposed = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});
	async function comment(region: Region | null) {
		if (!workspace.bridge || !selected || !workspace.snapshot?.writable) return;
		try {
			const thread = await workspace.bridge.openThread({
				entityId: entity.id,
				version,
				imageSha256: selected.sha256,
				state: selected.state,
				viewport: selected.viewport,
				region
			});
			onthread(thread);
		} catch (cause) {
			error = String(cause);
		}
	}
	function imageLabel(v: DesignVersion) {
		return `${v.version}${v.approval?.current ? ' · Approved' : ''}`;
	}
</script>

<section class="panel design-panel">
	<div class="row">
		<h2>{entity.planned ? 'Proposed ' + entity.kind : 'Design'}</h2>
		{#if current}<span class="chip">{current.generator}</span><Select
				label="Design version"
				bind:value={version}
				>{#each entity.versions as v (v.version)}<option value={v.version}>{imageLabel(v)}</option
					>{/each}</Select
			><small>Committed design · {version}</small>{/if}
	</div>
	{#if current && selected}<div class="design-controls">
			<SegmentedChoice
				label="Viewport"
				bind:value={viewport}
				options={[...new Set(images.map((image) => image.viewport))]}
			/>
			<SegmentedChoice
				label="Image state"
				bind:value={imageState}
				options={[
					...new Set(
						images.filter((image) => image.viewport === viewport).map((image) => image.state)
					)
				]}
			/>
		</div>
		{#if url}<AnnotatedImage
				src={url}
				title={`${entity.title} ${version} ${selected.viewport} ${selected.state}`}
				{threads}
				writable={workspace.snapshot?.writable || false}
				{comment}
				select={onthread}
			/>{:else}<p class="empty">
				{error || 'Loading design image…'}
			</p>{/if}{:else if current}<article class="behavior-notes">
			<h3>Planned behavior</h3>
			<p>{current.notes || 'No behavior notes recorded for this version.'}</p>
		</article>{:else}<div class="empty">
			<h3>No design image yet</h3>
			<p>Use Plan to describe the first design.</p>
		</div>{/if}
	<div class="row measures">
		<span>Size · {entity.size.text || 'Not measured'}</span><span
			>Performance · {entity.performance.text || 'Not measured'}</span
		>
	</div>
</section>
