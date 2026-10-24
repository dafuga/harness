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
