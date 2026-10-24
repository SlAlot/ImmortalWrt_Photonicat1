/* SPDX-License-Identifier: AGPL-3.0-only */
#include <glib.h>
#include <stdlib.h>
#include <string.h>

static gboolean usb_id(const gchar *directory, const gchar *name, guint *result)
{
    gchar *filename = g_build_filename(directory, name, NULL);
    gchar *contents = NULL;
    gboolean found = g_file_get_contents(filename, &contents, NULL, NULL);
    g_free(filename);
    if (!found) return FALSE;
    gchar *value = g_strstrip(contents), *end = NULL;
    gsize length = strlen(value);
    unsigned long id = strtoul(value, &end, 16);
    gboolean valid = length == 4 && end == value + 4 && id <= 0xffff;
    for (gsize i = 0; valid && i < length; i++) valid = g_ascii_isxdigit(value[i]);
    if (valid) *result = (guint)id;
    g_free(contents);
    return valid;
}

/* Only read enumeration attributes. Never open AT ports, rfkill or GPIO. */
guint swrt_modem_power_usage_from(const gchar *root)
{
    GDir *directory = g_dir_open(root, 0, NULL);
    if (!directory) return G_MAXUINT;
    guint level = 0;
    const gchar *name;
    while ((name = g_dir_read_name(directory)) != NULL) {
        gchar *device = g_build_filename(root, name, NULL);
        guint vendor = 0, product = 0;
        gboolean valid = usb_id(device, "idVendor", &vendor) &&
                         usb_id(device, "idProduct", &product);
        g_free(device);
        if (valid && vendor == 0x2c7c) {
            /* Official v1 profiles: RM500U=2; other Quectel USB modems=1. */
            level = MAX(level, product == 0x0900 ? 2u : 1u);
        }
    }
    g_dir_close(directory);
    return level;
}

guint swrt_modem_power_usage_get(void)
{
    static gint64 next_scan;
    static guint cached;
    gint64 now = g_get_monotonic_time();
    if (now >= next_scan) {
        guint level = swrt_modem_power_usage_from("/sys/bus/usb/devices");
        if (level != G_MAXUINT) cached = level;
        next_scan = now + 5000000;
    }
    return cached;
}
