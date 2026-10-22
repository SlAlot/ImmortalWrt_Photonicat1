// Keep QuickStart's network/DNS failures; replace only its APK source probe.
export async function swrtNetworkStatus(response) {
    const status = response?.data?.result;
    if (status?.networkInfo !== 'softSourceFailed') return response;
    try {
        const check = await fetch('/cgi-bin/luci/admin/swrt/apk-status', {
            credentials: 'same-origin', cache: 'no-store',
            signal: AbortSignal.timeout(10000)
        });
        if (check.ok && (await check.json()).ok === true)
            status.networkInfo = 'netSuccess';
    } catch (_) {
        // A timeout, denied session or failed source must retain the warning.
    }
    return response;
}

const mode = window.swrt_theme_mode;
document.documentElement.dataset.swrtTheme = mode === 'dark' ? 'dark' :
    mode === 'light' ? 'light' : 'auto';
