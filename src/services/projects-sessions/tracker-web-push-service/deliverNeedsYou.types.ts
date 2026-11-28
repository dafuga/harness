// @harness-uid u_5x35b7bzsf
import type {
	NeedsYouPushMessage,
	PushSenderView
} from '../../../utils/projects-sessions/webPushContract.types';
import type { PushAsk, PushState } from './webPush.types';

export interface PushAttempt {
	asks: PushAsk[];
	keys: string[];
	state: PushState;
}

/** An attempt that is not held: the Hub said where to deliver. */
export type PushDeliveryAttempt = PushAttempt & {
	view: PushSenderView;
	message?: NeedsYouPushMessage;
};
