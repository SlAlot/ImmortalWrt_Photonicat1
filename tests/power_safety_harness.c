/* Execute the official kernel-backed manager with fake sysfs and no power actions. */
#define _GNU_SOURCE
#include <stdio.h>
#include <string.h>
#include <glib.h>
static guint battery = 3960, input = 5000, percentage = 78;
static gboolean missing;
static guint shutdown_requests;
static FILE *fixture_file(const char *name, const char *mode)
{
    guint value;
    if (mode[0] != 'r' || missing) return NULL;
    if (strstr(name, "battery/voltage_now")) value = battery * 1000;
    else if (strstr(name, "charger/voltage_now")) value = input * 1000;
    else if (strstr(name, "capacity")) value = percentage;
    else if (strstr(name, "online")) value = input >= 4200;
    else return NULL;
    FILE *file = tmpfile();
    g_assert_nonnull(file);
    fprintf(file, "%u\n", value);
    rewind(file);
    return file;
}
static gboolean no_power_action(const gchar *command, GError **error)
{
    (void)error;
    g_assert_cmpstr(command, ==, "poweroff");
    shutdown_requests++;
    return TRUE;
}
#define fopen fixture_file
#define g_spawn_command_line_async no_power_action
#include "pmu-manager.c"
#undef fopen
#undef g_spawn_command_line_async
static PCatManagerMainConfigData config;
static PCatManagerUserConfigData user;
PCatManagerMainConfigData *pcat_main_config_data_get(void) { return &config; }
PCatManagerUserConfigData *pcat_main_user_config_data_get(void) { return &user; }
void pcat_main_user_config_data_sync(void) { }
int main(void)
{
    PCatPMUManagerData *state = &g_pcat_pmu_manager_data;
    int descriptors[2];
    g_assert_cmpint(pipe(descriptors), ==, 0);
    state->initialized = TRUE;
    state->dev_fd = descriptors[1];
    state->dev_channel = g_io_channel_unix_new(descriptors[1]);
    state->dev_write_command_queue = g_queue_new();
    state->power_on_event = 1;
    user.charger_on_auto_start = TRUE;
    user.charger_on_auto_start_timeout = 1;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_true(state->swrt_status_valid);
    g_assert_cmpuint(state->last_battery_percentage, ==, 7800);
    g_assert_false(state->last_on_battery_state);
    /* Official manual boot stays running after unplug, even with a saved car mode. */
    input = 0;
    state->charger_on_auto_start_last_timestamp = g_get_monotonic_time() - 2000000;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_true(state->last_on_battery_state);
    g_assert_cmpuint(shutdown_requests, ==, 0);
    /* A charger-triggered boot follows the official delayed poweroff policy. */
    state->power_on_event = 3;
    input = 5000;
    pcat_pmu_manager_check_timeout_func(state);
    input = 0;
    state->charger_on_auto_start_last_timestamp = g_get_monotonic_time() - 2000000;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_cmpuint(shutdown_requests, ==, 1);
    state->shutdown_request = FALSE;
    /* Missing/malformed sysfs cannot fabricate charge or trigger UPS poweroff. */
    missing = TRUE;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_false(state->swrt_status_valid);
    g_assert_false(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));
    g_assert_cmpuint(shutdown_requests, ==, 1);
    missing = FALSE;
    battery = 0;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_false(state->swrt_status_valid);
    g_assert_cmpuint(shutdown_requests, ==, 1);
    battery = 3960; input = 5000;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_true(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));
    GIOChannel *channel = state->dev_channel;
    state->dev_channel = NULL;
    g_assert_false(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));
    state->dev_channel = channel;
    state->swrt_report_at -= 16000000;
    g_assert_false(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));
    if (state->dev_write_source) g_source_remove(state->dev_write_source);
    g_queue_free_full(state->dev_write_command_queue, (GDestroyNotify)pcat_pmu_manager_command_data_free);
    g_io_channel_shutdown(state->dev_channel, FALSE, NULL);
    g_io_channel_unref(state->dev_channel);
    close(descriptors[0]);
    puts("Official sysfs power status, manual/charger boot and invalid-reading safety passed");
    return 0;
}
