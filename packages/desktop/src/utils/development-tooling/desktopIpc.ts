/**
 * The one channel the main process answers over IPC: the bootstrap of the caller's own loopback
 * socket. Every project operation and the control port travel over that socket.
 */
export const bootstrapChannel = 'transport:bootstrap';

export { desktopIpc } from '../../lib/development-tooling/desktop-initialization/initialize-desktop/desktopIpc';

export type { DesktopIpcPort } from './desktopIpc.types';
