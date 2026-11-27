export type TrackerRoute = 'items' | 'runs' | 'machines' | 'status';
export type TrackerReply = () => Response | Promise<Response>;
export type TrackerCall = {
	url: string;
	method: string | undefined;
	redirect: string | undefined;
	cache: string | undefined;
	credentials: string | undefined;
	headers: Record<string, string> | undefined;
};
