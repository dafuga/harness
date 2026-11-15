import { BuildIdentityService } from '../../../../../../src/services/verification-evidence/BuildIdentityService';
import { recordCapture } from '../../../../../../src/utils/record-capture/recordCapture';
import { desktopCaptureEvidence } from './desktopStateActions';
import { previewCaptureNote } from './previewCapturePolicy';
import { previewState } from './catalogUnits';
import type { PreviewCaptureRecord } from './recordPreviewCapture.types';

export async function recordPreviewCapture(
	home: string,
	{ id, variant, viewport, clip, bytes, reportDialog }: PreviewCaptureRecord
) {
	const state = previewState(id, variant);
	const served = await new BuildIdentityService().identify(home);
	recordCapture(
		{
			evidence: desktopCaptureEvidence(id, variant),
			kind: 'screenshot',
			state,
			viewport,
			clip,
			file: `${state}-${viewport}.png`,
			mediaType: 'image/png',
			provenance: 'actual-capture',
			note: reportDialog
				? 'Visible viewport with the report dialog open. Synthetic representative inputs; real backend and native-device behavior are not reproduced.'
				: previewCaptureNote(id, variant),
			server: {
				buildId: served?.buildId ?? 'not-built',
				revision: process.env.HARNESS_VERIFY_REVISION ?? '0'.repeat(40)
			}
		},
		bytes
	);
}
