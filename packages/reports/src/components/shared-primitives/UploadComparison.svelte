<!-- @harness-tier organism -->
<!-- @harness-atoms atoms -->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Report } from '../../models/reports-media/Report.types';
	import Select from './Select.svelte';
	let { reportId, onUploaded }: { reportId: string; onUploaded: (report: Report) => void } =
		$props();
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

<hx-details class="upload-comparison">
	<hx-summary
		><hx-span>Add before/after comparison</hx-span><hx-span aria-hidden="true">↗</hx-span
		></hx-summary
	>
	<hx-form onsubmit={upload}>
		<hx-div class="upload-fields">
			<hx-label class="upload-title"
				>Comparison title
				<hx-input
					name="title"
					maxlength="120"
					required
					placeholder="What changed?"
					disabled={uploading}
				/>
			</hx-label>
			<hx-label
				>Viewport
				<Select label="Viewport" name="viewport" disabled={uploading}>
					<hx-option value="">Not specified</hx-option>
					<hx-option value="mobile">390px mobile</hx-option>
					<hx-option value="tablet">920px tablet</hx-option>
					<hx-option value="desktop">1440px desktop</hx-option>
				</Select>
			</hx-label>
		</hx-div>
		<hx-div class="upload-pair">
			<hx-label
				>Before screenshot
				<hx-input
					name="before"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					required
					disabled={uploading}
					onchange={(event) => (beforeName = event.currentTarget.files?.[0]?.name || '')}
				/>
				<hx-span class="file-choose">Choose image</hx-span>
				<hx-small>{beforeName || 'Choose PNG, JPEG or WebP'}</hx-small>
			</hx-label>
			<hx-label
				>After screenshot
				<hx-input
					name="after"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					required
					disabled={uploading}
					onchange={(event) => (afterName = event.currentTarget.files?.[0]?.name || '')}
				/>
				<hx-span class="file-choose">Choose image</hx-span>
				<hx-small>{afterName || 'Choose PNG, JPEG or WebP'}</hx-small>
			</hx-label>
		</hx-div>
		<hx-div class="upload-actions">
			<hx-button class="button primary" type="submit" disabled={uploading || !ready}
				>Upload comparison</hx-button
			>
			{#if message}<hx-p class={'badge ' + messageKind} role="status">{message}</hx-p>{/if}
		</hx-div>
	</hx-form>
</hx-details>
