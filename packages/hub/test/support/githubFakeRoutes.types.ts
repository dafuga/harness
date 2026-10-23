import type { FakeState } from './githubFakeState';
import type { FakeCall } from './githubFakeState';

export type FakeHandler = (
	state: FakeState,
	call: FakeCall,
	match: RegExpExecArray
) => Promise<Response> | Response;
