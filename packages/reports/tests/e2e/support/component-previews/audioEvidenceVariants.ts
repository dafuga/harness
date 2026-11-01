import type { PreviewCases } from './shared';

const statusTranscripts: Record<string, string> = {
	running: 'The accessibility readback is still in progress; sign-off is pending.',
	failed: 'The review found an unlabeled control in the audio player.',
	blocked: 'The readback is blocked until the playback issue is resolved.',
	skipped: 'The accessibility readback was skipped for this release.',
	'not-proven': 'The review could not establish a complete readback result.',
	interrupted: 'The recording ended before the accessibility review was complete.'
};

/** Present playback, optional details, failures and status from one recording at a time. */
export function audioEvidenceVariant(props: PreviewCases[string], variant: string) {
	const item = props.item as Record<string, unknown>;
	if (['playing', 'transcript-closed'].includes(variant)) return props;
	if (['notes', 'notes-closed'].includes(variant))
		return {
			...props,
			item: {
				...item,
				transcript: undefined,
				note: 'Timing and diction were reviewed before approval.'
			}
		};
	if (['notes-transcript', 'notes-transcript-closed'].includes(variant))
		return {
			...props,
			item: { ...item, note: 'Timing and diction were reviewed before approval.' }
		};
	if (variant === 'no-details')
		return { ...props, item: { ...item, transcript: undefined, note: undefined } };
	if (variant === 'minimal') return { ...props, item: minimalRecording(item) };
	if (variant.startsWith('phase-'))
		return { ...props, item: { ...item, phase: variant.slice('phase-'.length) } };
	if (variant === 'standing')
		return { ...props, item: { ...item, standing: 'Baseline recording' } };
	if (variant === 'audio-error')
		return {
			...props,
			item: { ...item, file: 'preview-corrupt.wav', note: 'The recording could not be decoded.' }
		};
	if (variant === 'unavailable')
		return {
			...props,
			item: {
				...item,
				file: '',
				missing: true,
				note: 'The original recording was not retained with this evidence.'
			}
		};
	const transcript = statusTranscripts[variant];
	return transcript ? { ...props, item: { ...item, status: variant, transcript } } : null;
}

function minimalRecording(item: Record<string, unknown>) {
	return {
		...item,
		source: undefined,
		capturedAt: undefined,
		provenance: undefined,
		transcript: undefined,
		note: undefined,
		durationSeconds: undefined
	};
}
