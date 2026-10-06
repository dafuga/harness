<script lang="ts">
	import { t } from '../utils/reportLocale';
	let { mode, uploading }: { mode: string; uploading: boolean } = $props();
	const ACCEPT =
		'.wav,.mp3,.m4a,.ogg,audio/wav,audio/x-wav,audio/wave,audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg';
	// Single uploads keep the original `audio` field; comparisons post `before` and `after`.
	const SINGLE = [{ name: 'audio', label: 'audioFile' }];
	const PAIRED = [
		{ name: 'before', label: 'beforeAudioFile' },
		{ name: 'after', label: 'afterAudioFile' }
	];
	let paired = $derived(mode === 'comparison');
	let fields = $derived(paired ? PAIRED : SINGLE);
	// The parent remounts this component after a reset or mode change, which clears these names.
	let names = $state<Record<string, string>>({});
</script>

<div class="upload-pair upload-files" class:paired>
	{#each fields as field (field.name)}
		<label
			>{$t(field.label)}
			<input
				name={field.name}
				type="file"
				accept={ACCEPT}
				required
				disabled={uploading}
				aria-label={$t(field.label)}
				aria-describedby={`upload-${field.name}-file-hint`}
				onchange={(event) => (names[field.name] = event.currentTarget.files?.[0]?.name || '')}
			/>
			<span class="file-choose" aria-hidden="true">{$t('chooseAudio')}</span>
			<small
				id={`upload-${field.name}-file-hint`}
				class:chosen={Boolean(names[field.name])}
				aria-hidden="true">{names[field.name] || $t('audioFileHint')}</small
			>
		</label>
	{/each}
</div>
