// @harness-uid u_sgoclx37n5
import type { ThreadDraft } from '../../../models/development-tooling/DesktopBridge.types';

/** Validated thread fields before the caller supplies its project context. */
export type ThreadPayload = Omit<ThreadDraft, 'projectId'>;

/** A desktop request whose shape or field values fail validation before any work starts. */
export { InvalidPayloadError } from './InvalidPayloadError';
