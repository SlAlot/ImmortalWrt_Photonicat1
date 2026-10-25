/* SPDX-License-Identifier: AGPL-3.0-only */
#ifndef SWRT_SCHEDULE_TIME_H
#define SWRT_SCHEDULE_TIME_H
#include <glib.h>
gboolean swrt_daily_utc(gint hour, gint minute, GDateTime *now,
                       gint *utc_hour, gint *utc_minute);
#endif
