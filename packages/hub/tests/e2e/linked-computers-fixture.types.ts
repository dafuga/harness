export interface LinkedComputerOptions {
	/** Lists a second computer that is offline. On unless turned off. */
	offline?: boolean;
	/** False while the account has no linked computer. Asked on every read. */
	present?: () => boolean;
	/** The Mac answers `homeSnapshot` only once this settles. */
	held?: Promise<void>;
}
