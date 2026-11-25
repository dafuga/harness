// @harness-uid u_liy3gizotu
// @harness-uid u_ask0pt1typ
/** One answer Daniel can tap: a short label and what happens when it is chosen. */
export interface TrackerAskOption {
	label: string;
	effect: string;
	recommended?: true;
}

/** Asks of these kinds change something that is hard to undo, so a tap needs a confirm step. */
export type TrackerAskConfirm = 'deploy' | 'money' | 'secret';
