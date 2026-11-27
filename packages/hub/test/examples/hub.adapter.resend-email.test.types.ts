export type Respond = () => Response | Promise<Response>;

export type Call = { url: string; init: RequestInit };
