/** How Git cleans a message file before it stores the message. */
export interface MessageCleanup {
	/** `commit.cleanup` of the repository; an edited message is stripped unless this says otherwise. */
	cleanup?: string;
	/** `core.commentChar`; a hash unless the repository chose another. */
	comment?: string;
}
