// @harness-uid u_gndb6l2t6f
export interface TranslationRegistration {
	locale: string;
	messages?: Record<string, string>;
	resource?: string;
}

export interface TranslationSource {
	registrations: TranslationRegistration[];
	keys: string[];
	gaps: string[];
}

/** A translation dictionary or locale registration that cannot be read as static messages. */
export class UnreadableDictionaryError extends Error {
	override name = 'UnreadableDictionaryError';
}
