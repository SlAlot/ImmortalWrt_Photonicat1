/* Exercise local daily wake times against a UTC MCU, including midnight and DST. */
#include <glib.h>
#include <stdio.h>
#include "swrt-schedule-time.h"
static void check(const char *zone, int year, int month, int day, int now_hour,
                  int hour, int minute, int expected_hour, int expected_minute)
{
    GTimeZone *tz = g_time_zone_new_identifier(zone);
    g_assert_nonnull(tz);
    GDateTime *now = g_date_time_new(tz, year, month, day, now_hour, 0, 0);
    int h = -1, m = -1;
    g_assert_true(swrt_daily_utc(hour, minute, now, &h, &m));
    g_assert_cmpint(h, ==, expected_hour);
    g_assert_cmpint(m, ==, expected_minute);
    g_date_time_unref(now);
    g_time_zone_unref(tz);
}
int main(void)
{
    check("CST-8", 2026, 10, 26, 1, 7, 25, 23, 25);
    check("CST-8", 2026, 12, 31, 23, 7, 25, 23, 25);
    check("UTC", 2026, 10, 26, 1, 7, 25, 7, 25);
    check("EST5", 2026, 10, 26, 12, 23, 15, 4, 15);
    check("IST-5:30", 2026, 10, 26, 1, 7, 25, 1, 55);
    check("NPT-5:45", 2026, 10, 26, 1, 7, 25, 1, 40);
    check("EST5EDT,M3.2.0/2,M11.1.0/2", 2026, 3, 7, 12, 7, 0, 11, 0);
    check("EST5EDT,M3.2.0/2,M11.1.0/2", 2026, 10, 31, 12, 7, 0, 12, 0);
    int h, m;
    g_assert_false(swrt_daily_utc(24, 0, NULL, &h, &m));
    puts("UTC daily wake encoding: midnight, year rollover, half-hour offsets and DST passed");
    return 0;
}
