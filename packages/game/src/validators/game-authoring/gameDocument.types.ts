export type RecordValue = Record<string, unknown>;
/** A game document that failed validation; its message joins those messages with '; '. */
export class InvalidGameDocumentError extends Error {
	override name = 'InvalidGameDocumentError';
}
