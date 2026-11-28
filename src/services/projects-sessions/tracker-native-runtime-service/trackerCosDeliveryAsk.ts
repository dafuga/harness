// @harness-uid u_bl6xl2h4a3
import type { NeedsYouPushMessage } from '../../../utils/projects-sessions/webPushContract.types';
import type { TrackerCosSafetyNotice } from './trackerCosDelivery.types';

/** The safety notice identifies only the size of the queue. */
export function cosSafetyMessage(notice: TrackerCosSafetyNotice): NeedsYouPushMessage {
	const { count } = notice;
	return {
		title: "Chief of Staff isn't responding",
		body: count === 1 ? '1 ask is waiting' : `${count} asks are waiting`,
		needs: 'all'
	};
}
