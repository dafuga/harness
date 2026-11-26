import type { browserProjects } from '../../src/routes/browserProjects';
import type { invitationLink } from '../../src/components/projects-sessions/invitation-form/browserProjects';
import type { BrowserProjects } from '../../src/utils/projects-sessions/browserProjects';

export type Api = Parameters<typeof browserProjects>[0];

export type Call = { method: string; path: string; body?: unknown };

export type Invite = Parameters<typeof invitationLink>[1];

export type InviteInput = Parameters<BrowserProjects['invite']>[1];
