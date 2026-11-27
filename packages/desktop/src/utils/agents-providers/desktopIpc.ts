// @harness-uid u_dzcerery3f
/**
 * The bootstrap channel opens the caller's own loopback
 * socket. Every project operation and the control port travel over that socket.
 */
export const bootstrapChannel = 'transport:bootstrap';
export const deviceApprovalChannel = 'hosted:device-approval';

export { desktopIpc } from '../../lib/development-tooling/desktop-initialization/initialize-desktop/desktopIpc';

export type { DesktopIpcPort } from './desktopIpc.types';
