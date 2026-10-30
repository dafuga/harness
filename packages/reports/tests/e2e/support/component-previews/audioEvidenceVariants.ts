import type { PreviewCases } from './shared';

const statuses = ['running', 'failed', 'blocked', 'skipped', 'not-proven', 'interrupted'];

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
	if (variant === 'notes-transcript')
		return {
			...props,
			item: { ...item, note: 'Timing and diction were reviewed before approval.' }
		};
	if (variant === 'no-details')
		return { ...props, item: { ...item, transcript: undefined, note: undefined } };
	if (variant === 'no-duration') return { ...props, item: { ...item, durationSeconds: undefined } };
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
	return statuses.includes(variant) ? { ...props, item: { ...item, status: variant } } : null;
}
