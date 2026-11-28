export interface TrackerUnattendedCaller {
	/** A role name, not a path: this repository is public. */
	caller: string;
	computers: readonly ('daniel-primary-mbp' | 'harbor-mbp-2')[];
	calls: readonly TrackerUnattendedCall[];
}

export interface TrackerUnattendedCall {
	/** The argument words the installed script passes; `ITEM` stands for its target. */
	args: readonly string[];
	/**
	 * `accepted`: the command succeeds. `asks`: it also opens a Daniel decision.
	 * `alerts`: it records the message for Chief of Staff without opening a decision.
	 * `kept`: a legacy flag that is refused, yet reaches Chief of Staff.
	 */
	outcome: 'accepted' | 'asks' | 'alerts' | 'kept';
}
