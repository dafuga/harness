// @harness-uid u_x2yyzg7vea
import { homedir } from 'node:os';
import { join } from 'node:path';

export function xDigestHome(): string {
	return join(homedir(), '.harness', 'x-digest');
}
