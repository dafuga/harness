export interface Made {
	exitCode: number;
	stderr: string;
	/** The message file as the hook was given it, and the message Git stored from it. */
	seen: string;
	stored: string;
}

export interface How {
	config?: string[];
	flags?: string[];
	/** The script that writes the message as an editor would; without one the text is given with -F. */
	editor?: string;
}
