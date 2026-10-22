// Keep QuickStart's network/DNS failures; replace only its APK source probe.
export async function swrtNetworkStatus(response) {
    const status = response?.data?.result;
    if (!['softSourceFailed', 'netSuccess'].includes(status?.networkInfo)) return response;
    try {
        const check = await fetch('/cgi-bin/luci/admin/swrt/apk-status', {
            credentials: 'same-origin', cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        if (check.ok) {
            const result = await check.json();
            if (result.available !== false)
                status.networkInfo = result.ok === true ? 'netSuccess' : 'softSourceFailed';
        }
    } catch (_) {
        // A timeout, denied session or failed source must retain the warning.
    }
    return response;
}

const mode = window.swrt_theme_mode;
document.documentElement.dataset.swrtTheme = mode === 'dark' ? 'dark' :
    mode === 'light' ? 'light' : 'auto';
