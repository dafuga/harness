import type { NativeHandoffService } from './native-handoff-service/NativeHandoffService';
import type { RequestSessionService } from './request-session-service/RequestSessionService';

export interface NativeHandoffControllerOptions {
	handoff: NativeHandoffService;
	sessions: RequestSessionService;
}
