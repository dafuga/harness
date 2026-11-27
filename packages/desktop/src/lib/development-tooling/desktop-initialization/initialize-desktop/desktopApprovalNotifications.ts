// @harness-uid u_qiwc46aocx
import { app, Notification } from 'electron';
import type { BrowserWindow } from 'electron';
import { resolve } from 'node:path';
import type { NativeAuthService } from '../NativeAuthService';
import { NativeApprovalNotifications } from '../NativeApprovalNotifications';

export function packagedApprovalHelper(): string | undefined {
	if (app.isPackaged && process.platform === 'darwin')
		return resolve(process.resourcesPath, '../Helpers/HarnessDeviceApproval');
}

function promptDeviceApproval(currentWindow: () => BrowserWindow | undefined) {
	const alert = new Notification({
		title: 'Device approval requested',
		body: 'Open Harness to review the new sign-in.'
	});
	alert.on('click', () => {
		const window = currentWindow();
		if (!window) return void app.emit('activate');
		if (window.isMinimized()) window.restore();
		window.show();
		window.focus();
	});
	alert.show();
}

export function refreshAccountInBackground(
	auth: NativeAuthService | undefined,
	currentWindow: () => BrowserWindow | undefined
) {
	if (!auth) return;
	const notify =
		packagedApprovalHelper() && Notification.isSupported()
			? () => promptDeviceApproval(currentWindow)
			: undefined;
	const observer = new NativeApprovalNotifications(auth, notify);
	const refresh = () => void observer.refresh();
	refresh();
	return setInterval(refresh, 60_000).unref();
}
