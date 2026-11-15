import type { FrameFlag } from '../../../../../../src/services/verification-evidence/FrameFlagService.types';
import type { PreviewProps } from './shared.types';
import { videoEvidenceProps } from './videoEvidenceProps';

export function videoPlayerVariantProps(variant: string, flags: FrameFlag[]): PreviewProps {
	const props: PreviewProps = {
		...structuredClone(videoEvidenceProps),
		assetBase: '/media/',
		initialFlags: flags
	};
	if (variant === 'without-initial-flags') delete props.initialFlags;
	if (variant === 'empty-asset-base') props.assetBase = '';
	if (variant === 'failed')
		props.item = {
			...videoEvidenceProps.item,
			status: 'failed',
			missing: true,
			note: 'The recording failed.'
		};
	if (variant === 'empty')
		props.item = {
			...videoEvidenceProps.item,
			file: '',
			missing: true,
			note: 'No video was recorded.'
		};
	return props;
}
