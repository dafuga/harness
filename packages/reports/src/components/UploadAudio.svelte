<script lang="ts">
	import { onMount } from 'svelte';
	import type { Report } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import AudioUploadFiles from './AudioUploadFiles.svelte';
	import Select from './Select.svelte';
	type Kind = 'running' | 'passed' | 'failed';
	let { reportId, onUploaded }: { reportId: string; onUploaded: (report: Report) => void } =
		$props();
	const MAX_BYTES = 50_000_000;
	let ready = $state(false);
	let uploading = $state(false);
	let message = $state('');
	let messageKind = $state<Kind>('running');
	let mode = $state('single');
	// Bumped after a successful upload so the file pickers remount without stale file names.
	let resetCount = $state(0);
	let paired = $derived(mode === 'comparison');
	onMount(() => {
		ready = true;
	});
	function announce(text: string, kind: Kind) {
		message = text;
		messageKind = kind;
	}
	function isReport(value: unknown): value is Report {
		return typeof value === 'object' && value !== null && Array.isArray((value as Report).evidence);
	}
	function errorText(value: unknown) {
		const error =
			typeof value === 'object' && value !== null && 'error' in value ? value.error : '';
		return typeof error === 'string' && error ? error : $t('uploadFailed');
	}
	function oversized(body: FormData, fields: string[]) {
		return fields.some((field) => {
			const file = body.get(field);
			return file instanceof File && file.size > MAX_BYTES;
		});
	}
	// One submit path for both modes; the mode picks the endpoint and file fields only.
	async function upload(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const comparison = paired;
		// Read fields before `uploading` disables them; disabled controls are left out of FormData.
		const body = new FormData(form);
		// Every chosen file is checked before anything is disabled or sent.
		if (oversized(body, comparison ? ['before', 'after'] : ['audio']))
			return announce($t('audioTooLarge'), 'failed');
		body.set('reportId', reportId);
		uploading = true;
		announce($t(comparison ? 'uploadingAudioComparison' : 'uploadingAudio'), 'running');
		try {
			const endpoint = comparison ? '/api/report-audio-comparison' : '/api/report-audio-upload';
			const response = await fetch(endpoint, { method: 'POST', body });
			const result: unknown = await response.json().catch(() => null);
			if (response.status !== 201 || !isReport(result))
				return announce(errorText(result), 'failed');
			onUploaded(result);
			form.reset();
			resetCount += 1;
			announce($t(comparison ? 'audioComparisonAdded' : 'audioAdded'), 'passed');
		} catch {
			announce($t('uploadFailed'), 'failed');
		} finally {
			uploading = false;
		}
	}
</script>

<!-- Shares the comparison upload framing; `upload-audio` adds the mode, notes field and spacing. -->
<details class="upload-comparison upload-audio">
	<summary><span>{$t('addAudio')}</span><span aria-hidden="true">↗</span></summary>
	<!-- Mode sits outside the form, so the reset after an upload keeps the chosen mode. -->
	<label class="upload-mode"
		>{$t('audioUploadMode')}
		<Select
			bind:value={mode}
			label={$t('audioUploadMode')}
			name="mode"
			disabled={uploading || !ready}
		>
			<option value="single">{$t('singleRecording')}</option>
			<option value="comparison">{$t('pairedRecordings')}</option>
		</Select>
	</label>
	<form onsubmit={upload}>
		<div class="upload-fields">
			<label class="upload-title"
				>{$t('audioTitle')}
				<input
					name="title"
					maxlength="120"
					required
					placeholder={$t('audioTitlePlaceholder')}
					disabled={uploading}
				/>
			</label>
			<label
				>{$t('source')}
				<input
					name="source"
					maxlength="200"
					placeholder={$t('audioSourcePlaceholder')}
					disabled={uploading}
				/>
			</label>
		</div>
		{#key `${mode}:${resetCount}`}<AudioUploadFiles {mode} {uploading} />{/key}
		<label class="upload-note"
			>{$t('notes')}
			<textarea
				name="note"
				maxlength="2000"
				rows="3"
				placeholder={$t('audioNotesPlaceholder')}
				disabled={uploading}
			></textarea>
		</label>
		<p class="upload-storage muted">{$t('audioStorageNote')}</p>
		<div class="upload-actions">
			<button class="button primary" type="submit" disabled={uploading || !ready}
				>{$t(paired ? 'uploadAudioComparison' : 'uploadAudio')}</button
			>
			<div class="upload-status" role="status">
				{#if message}<span class={'badge ' + messageKind}>{message}</span>{/if}
			</div>
		</div>
	</form>
</details>
