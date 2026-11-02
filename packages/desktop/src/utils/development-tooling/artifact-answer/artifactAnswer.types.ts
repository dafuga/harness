// @harness-uid u_x7rrgdmohq
import type { HarnessCapture } from '$reports/models/Harness.types';

export type Listed = Pick<HarnessCapture, 'kind' | 'mediaType' | 'sha256' | 'media' | 'gap'>;
