import type { fixture } from './run-fixture';

/**
 * Something new asked of the project agent: a visual plan it proposes is made as separately
 * directed design options saved as one version, three unless asked otherwise, whatever catalog the
 * request came from; a headless one makes no image; a failed option saves no version.
 */
export type Made = Awaited<ReturnType<typeof fixture>>;
