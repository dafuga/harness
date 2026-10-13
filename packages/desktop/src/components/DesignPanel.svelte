<script lang="ts">
	import Select from '$shared/Select.svelte';
	import SegmentedChoice from './SegmentedChoice.svelte';
	import type { DesignVersion, EntityDetail, Region, ThreadInfo } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	import { imageUrl } from '../utils/imageUrl';
	import { priorImage } from '../utils/priorImage';
	import { imageTarget, type ThreadTarget } from '../utils/threadAnchor';
	import AnnotatedImage from './AnnotatedImage.svelte';
	import PriorImage from './PriorImage.svelte';
	let {
		entity,
		workspace,
		annotatable,
		version = $bindable(''),
		onthread,
		onannotate
	}: {
		entity: EntityDetail;
		workspace: Workspace;
		/** Whether an image or a region of it can start a thread here. */
		annotatable: boolean;
		version?: string;
		onthread: (thread: ThreadInfo) => void;
		onannotate: (target: ThreadTarget) => Promise<void>;
	} = $props();
	let viewport = $state('desktop');
	let imageState = $state('default');
	let url = $state('');
	let error = $state('');
	const current = $derived(entity.versions.find((v) => v.version === version));
	const images = $derived(current?.images || []);
	/** The plan of a function is notes and cases: no image of it is chosen, asked for or drawn. */
	const headless = $derived(entity.category === 'functions');
	const selected = $derived(
		headless ? undefined : images.find((i) => i.viewport === viewport && i.state === imageState)
	);
	/** Only a commit view has a commit whose change can be shown as before and after. */
	const viewed = $derived(workspace.pinned ? (workspace.snapshot?.revision.commit ?? null) : null);
	const before = $derived(priorImage(entity.versions, { version, image: selected }, viewed));
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
		const request = selected && { entityId: entity.id, version, sha256: selected.sha256 };
		return imageUrl(workspace, request || null, (value, cause) => {
			url = value;
			error = cause;
		});
	});
	async function comment(region: Region | null) {
		if (!selected || !annotatable) return;
		try {
			await onannotate(imageTarget(version, selected, region));
		} catch (cause) {
			error = String(cause);
		}
	}
	const proposed = 'A plan is what is proposed. What the tests observed is under Overview.';
	const earlier =
		' This version also recorded a picture; it stays in the history and is not shown for a function.';
	/** What an entity without a version says: how to start one, or that none was committed. */
	const empty = $derived(
		headless
			? {
					planning: 'Use Plan to describe the behavior and its cases.',
					committed: 'No plan has been committed for this function.'
				}
			: {
					planning: 'Use Plan to describe the first design.',
					committed: 'No design has been committed for this entity.'
				}
	);
	function imageLabel(v: DesignVersion) {
		return `${v.version}${v.approval?.current ? ' · Approved' : ''}`;
	}
</script>

<section class="panel design-panel">
	<div class="row">
		<h2>{headless ? 'Plan' : entity.planned ? 'Proposed ' + entity.kind : 'Design'}</h2>
		{#if current}{#if !headless}<span class="chip">{current.generator}</span>{/if}<Select
				label={headless ? 'Plan version' : 'Design version'}
				bind:value={version}
				>{#each entity.versions as v (v.version)}<option value={v.version}>{imageLabel(v)}</option
					>{/each}</Select
			><small>Committed {headless ? 'plan' : 'design'} · {version}</small>{/if}
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
		<div class:before-after={before}>
			{#if before}<PriorImage
					{workspace}
					entityId={entity.id}
					version={before.version}
					sha256={before.sha256}
					title={`${entity.title} ${before.version} ${selected.viewport} ${selected.state}`}
				/>{/if}{#if url}<AnnotatedImage
					src={url}
					title={`${entity.title} ${version} ${selected.viewport} ${selected.state}`}
					caption={before ? `After · ${version}` : ''}
					{threads}
					writable={annotatable}
					{comment}
					select={onthread}
				/>{:else}<p class="empty">{error || 'Loading design image…'}</p>{/if}
		</div>{:else if current}<article class="behavior-notes">
			<h3>Planned behavior</h3>
			<p>{current.notes || 'No behavior notes recorded for this version.'}</p>
			{#if headless}<p class="muted">{proposed}{current.images.length ? earlier : ''}</p>{/if}
		</article>{:else}<div class="empty">
			<h3>{headless ? 'No plan yet' : 'No design image yet'}</h3>
			<p>{workspace.capabilities.planning ? empty.planning : empty.committed}</p>
		</div>{/if}
	{#if error && url}<p class="error" role="alert">{error}</p>{/if}
	{#if entity.category === 'pages'}<div class="row measures">
			<span>Size · {entity.size.text || 'Not measured'}</span><span
				>Performance · {entity.performance.text || 'Not measured'}</span
			>
		</div>{/if}
</section>
