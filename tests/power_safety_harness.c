/* Exercise the prepared official state machine without a UART or power actions. */
#define _DEFAULT_SOURCE
#include <stdio.h>
#include <string.h>
#include <glib.h>

static FILE *discard_state_file(const char *name, const char *mode)
{
    (void)name; (void)mode;
    return NULL;
}
#define fopen discard_state_file
#include "pmu-manager.c"
#undef fopen

static PCatManagerMainConfigData config;
static PCatManagerUserConfigData user;
static unsigned int shutdown_requests;
PCatManagerMainConfigData *pcat_main_config_data_get(void) { return &config; }
PCatManagerUserConfigData *pcat_main_user_config_data_get(void) { return &user; }
void pcat_main_request_shutdown(gboolean send_request)
{
    (void)send_request;
    shutdown_requests++;
}
guint swrt_modem_power_usage_get(void) { return 0; }

static void report(guint battery, guint input)
{
    guint8 data[18] = {0};
    data[0] = battery & 0xff; data[1] = battery >> 8;
    data[2] = input & 0xff; data[3] = input >> 8;
    data[17] = 65;
    pcat_pmu_serial_status_data_parse(&g_pcat_pmu_manager_data, data, sizeof(data));
}

int main(void)
{
    PCatPMUManagerData *state = &g_pcat_pmu_manager_data;
    int descriptors[2];
    g_assert_cmpint(pipe(descriptors), ==, 0);
    state->initialized = TRUE;
    state->serial_fd = descriptors[1];
    state->serial_channel = g_io_channel_unix_new(descriptors[1]);
    state->serial_write_command_queue = g_queue_new();
    state->system_time_set_flag = TRUE;
    state->pmu_time_set_timestamp = g_get_monotonic_time();
    state->last_battery_percentage_cap = 10000;
    for (int i = 0; i < 128; i++) state->last_battery_voltages[i] = -1;
    memcpy(state->battery_discharge_table_normal, g_pat_pmu_manager_battery_discharge_table_normal,
           sizeof(state->battery_discharge_table_normal));
    memcpy(state->battery_charge_table, g_pat_pmu_manager_battery_charge_table,
           sizeof(state->battery_charge_table));
    user.charger_on_auto_start = TRUE;
    user.charger_on_auto_start_timeout = 1;

    /* A manual start on battery must never arm a saved UPS plan. */
    report(3900, 0);
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_false(state->swrt_ac_observed);
    g_assert_cmpuint(shutdown_requests, ==, 0);

    report(3900, 5000);
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_true(state->swrt_ac_observed);
    state->charger_on_auto_start_last_timestamp = g_get_monotonic_time() - 2000000;
    report(3900, 0);
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_cmpuint(shutdown_requests, ==, 1);
    state->shutdown_planned = FALSE;

    /* Restored external power resets the countdown. */
    report(3900, 5000);
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_cmpuint(shutdown_requests, ==, 1);

    state->swrt_ac_observed = FALSE;
    state->swrt_report_at = g_get_monotonic_time() - 16000000;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_false(state->swrt_ac_observed);
    g_assert_false(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));

    state->swrt_ac_observed = TRUE;
    state->last_charger_voltage = 0;
    state->charger_on_auto_start_last_timestamp = g_get_monotonic_time() - 2000000;
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_cmpuint(shutdown_requests, ==, 1);

    /* Invalid frames cannot refresh a reading or initiate automatic shutdown. */
    report(3900, 0);
    state->swrt_ac_observed = TRUE;
    state->charger_on_auto_start_last_timestamp = g_get_monotonic_time() - 2000000;
    report(0, 0);
    g_assert_cmpint(state->swrt_report_at, ==, 0);
    pcat_pmu_manager_check_timeout_func(state);
    g_assert_cmpuint(shutdown_requests, ==, 1);
    report(3900, 25000);
    g_assert_cmpint(state->swrt_report_at, ==, 0);

    report(3900, 5000);
    pcat_pmu_serial_close(state);
    g_assert_false(state->swrt_ac_observed);
    g_assert_cmpint(state->swrt_report_at, ==, 0);
    g_assert_false(pcat_pmu_manager_pmu_status_get(NULL, NULL, NULL, NULL));
    close(descriptors[0]);
    if (state->serial_write_current_command_data)
        pcat_pmu_manager_command_data_free(state->serial_write_current_command_data);
    g_queue_free_full(state->serial_write_command_queue,
                      (GDestroyNotify)pcat_pmu_manager_command_data_free);
    puts("UPS state machine: manual boot, supply restoration, stale/invalid reports and disconnect passed");
    return 0;
}
