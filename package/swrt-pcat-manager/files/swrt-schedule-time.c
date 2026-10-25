/* SPDX-License-Identifier: AGPL-3.0-only */
#include "swrt-schedule-time.h"

/* Device-local daily plans must be encoded against the MCU's UTC clock. */
gboolean swrt_daily_utc(gint hour, gint minute, GDateTime *now,
                       gint *utc_hour, gint *utc_minute)
{
    if (!now || hour < 0 || hour > 23 || minute < 0 || minute > 59)
        return FALSE;
    GDateTime *day = g_date_time_ref(now), *local = NULL;
    for (int attempt = 0; attempt < 2; attempt++) {
        local = g_date_time_new(g_date_time_get_timezone(day),
            g_date_time_get_year(day), g_date_time_get_month(day),
            g_date_time_get_day_of_month(day), hour, minute, 0);
        if (local && g_date_time_compare(local, now) > 0) break;
        if (local) { g_date_time_unref(local); local = NULL; }
        GDateTime *next = g_date_time_add_days(day, 1);
        g_date_time_unref(day);
        day = next;
    }
    g_date_time_unref(day);
    if (!local) return FALSE;
    GDateTime *utc = g_date_time_to_utc(local);
    *utc_hour = g_date_time_get_hour(utc);
    *utc_minute = g_date_time_get_minute(utc);
    g_date_time_unref(utc);
    g_date_time_unref(local);
    return TRUE;
}
