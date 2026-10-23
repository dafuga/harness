import type { desktopBackend } from './initializeDesktop';

export type Backend = ReturnType<typeof desktopBackend>;
