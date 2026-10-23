/**
 * Two offers under way at once, on the real pairing control and the real host pairing. The
 * relay is a link whose answers a test holds back and then gives or refuses. What one opening
 * cleans up is its own offer only: it never closes, returns or withdraws a newer one.
 */
export type Command = { type: string; pairingId: string };

export interface Held {
	command: Command;
	answer: () => void;
	refuse: (error: Error) => void;
}
