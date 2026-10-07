<script lang="ts">
	import { onMount } from 'svelte';
	import type { Report } from '../models/Report.types';
	let { reportId, onUploaded }: { reportId: string; onUploaded: (report: Report) => void } = $props();
	let ready = $state(false);
	let uploading = $state(false);
	let message = $state('');
	let messageKind = $state<'running' | 'passed' | 'failed'>('running');
	let beforeName = $state('');
	let afterName = $state('');
	onMount(() => {
		ready = true;
	});
	async function upload(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		uploading = true;
		message = 'Uploading…';
		messageKind = 'running';
		try {
			const body = new FormData(form);
			body.set('reportId', reportId);
			const response = await fetch('/api/report-screenshot-upload', { method: 'POST', body });
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || 'Upload failed');
			onUploaded(result as Report);
			form.reset();
			beforeName = '';
			afterName = '';
			message = 'Added to gallery';
			messageKind = 'passed';
		} catch (reason) {
			message = reason instanceof Error ? reason.message : 'Upload failed';
			messageKind = 'failed';
		} finally {
			uploading = false;
		}
	}
</script>

<details class="upload-comparison">
	<summary><span>Add before/after comparison</span><span aria-hidden="true">↗</span></summary>
	<form onsubmit={upload}>
		<div class="upload-fields">
			<label class="upload-title">Comparison title
				<input name="title" maxlength="120" required placeholder="What changed?" disabled={uploading} />
			</label>
			<label>Viewport
				<select name="viewport" disabled={uploading}>
					<option value="">Not specified</option>
					<option value="mobile">390px mobile</option>
					<option value="tablet">920px tablet</option>
					<option value="desktop">1440px desktop</option>
				</select>
			</label>
		</div>
		<div class="upload-pair">
			<label>Before screenshot
				<input name="before" type="file" accept="image/png,image/jpeg,image/webp" required
					disabled={uploading} onchange={(event) => (beforeName = event.currentTarget.files?.[0]?.name || '')} />
				<span class="file-choose">Choose image</span>
				<small>{beforeName || 'Choose PNG, JPEG or WebP'}</small>
			</label>
			<label>After screenshot
				<input name="after" type="file" accept="image/png,image/jpeg,image/webp" required
					disabled={uploading} onchange={(event) => (afterName = event.currentTarget.files?.[0]?.name || '')} />
				<span class="file-choose">Choose image</span>
				<small>{afterName || 'Choose PNG, JPEG or WebP'}</small>
			</label>
		</div>
		<div class="upload-actions">
			<button class="button primary" type="submit" disabled={uploading || !ready}>Upload comparison</button>
			{#if message}<p class={'badge ' + messageKind} role="status">{message}</p>{/if}
		</div>
	</form>
</details>
