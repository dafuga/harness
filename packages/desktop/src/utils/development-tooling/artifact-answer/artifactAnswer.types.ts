import type { HarnessCapture } from '../../../../../reports/src/models/Harness.types';

export type Listed = Pick<HarnessCapture, 'kind' | 'mediaType' | 'sha256' | 'media' | 'gap'>;
