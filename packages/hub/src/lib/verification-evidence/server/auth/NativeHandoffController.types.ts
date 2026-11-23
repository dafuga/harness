// @harness-uid u_4oll3wtumi
import type { NativeHandoffService } from './native-handoff-service/NativeHandoffService';
import type { RequestSessionService } from './request-session-service/RequestSessionService';

import type { SessionRepository } from '../../../../repositories/projects-sessions/SessionRepository';

export interface NativeHandoffControllerOptions {
	handoff: NativeHandoffService;
	sessions: RequestSessionService;
	repository: SessionRepository;
}
