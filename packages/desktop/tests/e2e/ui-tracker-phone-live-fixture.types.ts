export interface LivePhoneHost {
	__replica: {
		state: 'live' | 'reconnecting';
		question: string;
		emit: (changed: boolean) => void;
	};
}
