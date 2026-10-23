import type { RemoteAttachment } from '../../../models/networking-security/Remote.types';
import type { WireEvent } from '../../../models/networking-security/Remote.types';

export interface EventReplay {
	replay: RemoteAttachment['replay'];
	events: WireEvent[];
}
