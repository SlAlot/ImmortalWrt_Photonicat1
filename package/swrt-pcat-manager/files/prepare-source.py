#!/usr/bin/env python3
"""Keep the official kernel-backed manager's Photonicat 1 power interfaces."""
from pathlib import Path
import re
import sys


def replace(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Official power source changed; review kernel-backed profile")
    return text.replace(old, new, 1)


def write(path, payload):
    path.write_bytes(payload.encode("utf-8"))


def profile(root):
    root = Path(root)
    main = (root / "src/main.c").read_text(encoding="utf-8")
    main = replace(main, '''    if(!pcat_modem_manager_init())
    {
        g_warning("Failed to initialize modem manager, "
            "LTE/5G modem may not work!");
    }
''', "")
    main = replace(main, "    pcat_modem_manager_uninit();\n", "")
    main = replace(main, "    g_main_loop_run(g_pcat_main_loop);",
                   "    g_timeout_add_seconds(60, swrt_pmu_schedule_tick, NULL);\n"
                   "    g_main_loop_run(g_pcat_main_loop);")
    main, count = re.subn(r"^\s*pcat_modem_manager_iface_state_set\([^;]+;\n", "", main, flags=re.M)
    if count != 3 or "pcat_modem_manager_" in main:
        raise ValueError("Unexpected official modem dependency in main")
    write(root / "src/main.c", main)

    controller = (root / "src/controller.c").read_text(encoding="utf-8")
    keep = {"pmu_status", "schedule_power_event_set", "schedule_power_event_get",
            "charger_on_auto_start_set", "charger_on_auto_start_get", "pmu_fw_version_get"}
    handlers = re.findall(r"static void pcat_controller_command_(\w+)_func\(", controller)
    if not keep <= set(handlers):
        raise ValueError("Official power controller interfaces changed")
    for name in handlers:
        if name in keep:
            continue
        function = "pcat_controller_command_" + name + "_func"
        controller, count = re.subn(rf"\nstatic void {function}\([^\n]*(?:\n[^\n]*)*?\n\}}\n", "\n", controller, count=1)
        if count != 1:
            raise ValueError("Missing official handler: " + name)
        controller, count = re.subn(rf'    \{{\s*\.command = "[^"]+",\s*\.callback = {function},?\s*\}},\n', "", controller, count=1)
        if count != 1:
            raise ValueError("Missing official command registration: " + name)
    if "pcat_modem_manager_" in controller:
        raise ValueError("Unexpected modem dependency in power controller")
    controller = replace(controller, "    g_socket_service_start(ctrl_data->control_socket_service);",
                         "    g_chmod(PCAT_CONTROLLER_SOCKET_FILE, 0600);\n"
                         "    g_socket_service_start(ctrl_data->control_socket_service);")
    controller = replace(controller, '    child = json_object_new_int(countdown);',
                         '    json_object_object_add(rroot, "armed", json_object_new_boolean(swrt_pmu_ups_armed()));\n'
                         '    child = json_object_new_int(countdown);')
    controller = replace(controller, '    json_object_object_add(rroot, "event-list", array);',
                         '    json_object_object_add(rroot, "event-list", array);\n'
                         '    json_object_object_add(rroot, "timezone", json_object_new_string('
                         'g_getenv("TZ") != NULL ? g_getenv("TZ") : "UTC"));')
    write(root / "src/controller.c", controller)

    pmu = (root / "src/pmu-manager.c").read_text(encoding="utf-8")
    pmu = replace(pmu, '#include "pmu-manager.h"',
                  '#include "pmu-manager.h"\n#include "swrt-schedule-time.h"')
    if pmu.count("pcat_modem_manager_device_power_usage_get()") != 1:
        raise ValueError("Official modem profile changed")
    # All three voltage profiles are zero in the current official v1 system.
    # No modem-control backend is compiled into this power-only service.
    pmu = pmu.replace("pcat_modem_manager_device_power_usage_get()", "0")
    pmu = replace(pmu, "    guint last_battery_voltage;",
                  "    gboolean swrt_status_valid;\n    gint64 swrt_report_at;\n"
                  "    guint last_battery_voltage;")
    start = pmu.index("static void pcat_pmu_pm_status_get(")
    end = pmu.index("\nstatic ", start + 1)
    before, getter, after = pmu[:start], pmu[start:end], pmu[end:]
    getter = replace(getter, "    guint battery_voltage = 0, charger_voltage = 0;",
                     "    gboolean swrt_valid = TRUE;\n    guint battery_voltage = 0, charger_voltage = 0;")
    for variable in ("battery_voltage", "battery_percentage", "charger_voltage", "charger_online"):
        getter = replace(getter, f'        fscanf(fp, "%u", &{variable});',
                         f'        if(fscanf(fp, "%u", &{variable}) != 1) swrt_valid = FALSE;')
    # Missing required sysfs files must not become a fabricated 100% reading.
    getter = getter.replace('    if(fp!=NULL)\n    {', '    if(fp==NULL) swrt_valid = FALSE;\n    if(fp!=NULL)\n    {', 4)
    getter = replace(getter, "    pmu_data->last_on_battery_state = on_battery;",
                     "    pmu_data->swrt_status_valid = swrt_valid && battery_voltage >= 2500 &&\n"
                     "        battery_voltage <= 5000 && charger_voltage <= 24000 && battery_percentage <= 100;\n"
                     "    pmu_data->swrt_report_at = g_get_monotonic_time();\n"
                     "    pmu_data->last_on_battery_state = on_battery;")
    pmu = before + getter + after
    pmu = replace(pmu, "            if((pmu_data->power_on_event==3 || pmu_data->power_on_event==4) &&",
                  "            if(pmu_data->swrt_status_valid &&\n"
                  "               (pmu_data->power_on_event==3 || pmu_data->power_on_event==4) &&")
    signature = "gboolean pcat_pmu_manager_pmu_status_get("
    start = pmu.index(signature)
    end = pmu.index("\nvoid pcat_pmu_manager_schedule_time_update()", start)
    before, getter, after = pmu[:start], pmu[start:end], pmu[end:]
    getter = replace(getter, "    if(!g_pcat_pmu_manager_data.initialized)",
                     "    if(!g_pcat_pmu_manager_data.initialized ||\n"
                     "       g_pcat_pmu_manager_data.dev_channel == NULL ||\n"
                     "       !g_pcat_pmu_manager_data.swrt_status_valid ||\n"
                     "       g_get_monotonic_time() - g_pcat_pmu_manager_data.swrt_report_at >= 15000000)")
    pmu = before + getter + after
    start = pmu.index("static void pcat_pmu_manager_schedule_time_update_internal(")
    end = pmu.index("static void pcat_pmu_manager_charger_on_auto_start_internal(", start)
    before, schedule, after = pmu[:start], pmu[start:end], pmu[end:]
    schedule = replace(schedule, "            v = sdata->year & 0xFF;", """            gint swrt_hour = sdata->hour, swrt_minute = sdata->minute;
            if(sdata->enable_bits == 56 && sdata->dow_bits == 127)
            {
                GDateTime *now = g_date_time_new_now_local();
                gboolean valid = swrt_daily_utc(sdata->hour, sdata->minute,
                    now, &swrt_hour, &swrt_minute);
                g_date_time_unref(now);
                if(!valid) continue;
            }
            v = sdata->year & 0xFF;""")
    schedule = replace(schedule, "            v = sdata->hour;", "            v = swrt_hour;")
    schedule = replace(schedule, "            v = sdata->minute;", "            v = swrt_minute;")
    schedule = replace(schedule, """            pcat_pmu_pm_dev_write_data_request(pmu_data,
                PCAT_PMU_MANAGER_COMMAND_SCHEDULE_STARTUP_TIME_SET,
                startup_setup_buffer->data, startup_setup_buffer->len, TRUE);""",
        "            swrt_startup_send(pmu_data, startup_setup_buffer->data, startup_setup_buffer->len);")
    schedule = replace(schedule, """            pcat_pmu_pm_dev_write_data_request(pmu_data,
                PCAT_PMU_MANAGER_COMMAND_SCHEDULE_STARTUP_TIME_SET,
                NULL, 0, TRUE);""", "            swrt_startup_send(pmu_data, NULL, 0);")
    schedule = replace(schedule, """        pcat_pmu_pm_dev_write_data_request(pmu_data,
            PCAT_PMU_MANAGER_COMMAND_SCHEDULE_STARTUP_TIME_SET, NULL, 0, TRUE);""",
        "        swrt_startup_send(pmu_data, NULL, 0);")
    cache = """/* Refresh only changed UTC plans; do not repeatedly write unchanged MCU settings. */
static gint swrt_startup_size = -1;
static guint8 swrt_startup_data[48];
static void swrt_startup_send(PCatPMUManagerData *pmu_data, const guint8 *data, guint len)
{
    if(len > sizeof(swrt_startup_data)) return;
    if(swrt_startup_size == (gint)len && (!len || !memcmp(swrt_startup_data, data, len))) return;
    pcat_pmu_pm_dev_write_data_request(pmu_data,
        PCAT_PMU_MANAGER_COMMAND_SCHEDULE_STARTUP_TIME_SET, data, len, TRUE);
    if(len) memcpy(swrt_startup_data, data, len);
    swrt_startup_size = len;
}

"""
    pmu = before + cache + schedule + after
    start = pmu.index("void pcat_pmu_manager_schedule_time_update()")
    end = pmu.index("void pcat_pmu_manager_charger_on_auto_start(", start)
    before, refresh, after = pmu[:start], pmu[start:end], pmu[end:]
    refresh = replace(refresh, "    pcat_pmu_manager_schedule_time_update_internal(&g_pcat_pmu_manager_data);",
                      "    swrt_startup_size = -1;\n    pcat_pmu_manager_schedule_time_update_internal(&g_pcat_pmu_manager_data);")
    pmu = before + refresh + after
    pmu += "\ngboolean swrt_pmu_ups_armed(void) { return g_pcat_pmu_manager_data.swrt_status_valid && (g_pcat_pmu_manager_data.power_on_event == 3 || g_pcat_pmu_manager_data.power_on_event == 4); }\n"
    pmu += """
gboolean swrt_pmu_schedule_tick(gpointer unused)
{
    (void)unused;
    if(!g_pcat_pmu_manager_data.initialized || g_pcat_pmu_manager_data.dev_channel == NULL ||
       !g_pcat_pmu_manager_data.swrt_status_valid) return G_SOURCE_CONTINUE;
    const PCatManagerUserConfigData *config = pcat_main_user_config_data_get();
    if(config->power_schedule_data != NULL)
        for(guint i = 0; i < config->power_schedule_data->len; i++)
        {
            const PCatManagerPowerScheduleData *row = g_ptr_array_index(config->power_schedule_data, i);
            if(row->enabled && row->action && row->enable_bits == 56 && row->dow_bits == 127)
            {
                pcat_pmu_manager_schedule_time_update_internal(&g_pcat_pmu_manager_data);
                break;
            }
        }
    return G_SOURCE_CONTINUE;
}
"""
    write(root / "src/pmu-manager.c", pmu)
    header = (root / "src/pmu-manager.h").read_text(encoding="utf-8")
    header = replace(header, "G_END_DECLS", "gboolean swrt_pmu_ups_armed(void);\ngboolean swrt_pmu_schedule_tick(gpointer unused);\n\nG_END_DECLS")
    write(root / "src/pmu-manager.h", header)

    # Match the running official v1 configuration: zero preserves MCU defaults.
    config = "[PowerManager]\n" + "".join(key + "=0\n" for key in (
        "AutoShutdownVoltageGeneral", "AutoShutdownVoltageLTE", "AutoShutdownVoltage5G",
        "LEDHighVoltage", "LEDMediumVoltage", "LEDLowVoltage", "LEDWorkLowVoltage",
        "StartupVoltage", "ChargerLimitVoltage", "ChargerFastVoltage", "BatteryFullThreshold"))
    write(root / "conf/pcat-manager.conf.sample", config + "\n[Network]\nMwanRouteCheck=0\n")
    write(root / "meson.build", """project('swrt-pcat-manager', 'c')
power_dependencies = [dependency('glib-2.0'), dependency('gio-2.0'),
    dependency('gio-unix-2.0'), dependency('gthread-2.0'),
    dependency('json-c'), dependency('threads')]
subdir('src')
""")
    write(root / "src/meson.build", """executable('pcat-manager', ['main.c', 'pmu-manager.c', 'controller.c', 'swrt-schedule-time.c'],
    dependencies: power_dependencies, install: true)
executable('swrt-power-client', 'swrt-power-client.c',
    dependencies: power_dependencies, install: true)
""")
    for name in ("swrt-schedule-time.c", "swrt-schedule-time.h"):
        write(root / "src" / name, (Path(__file__).parent / name).read_text(encoding="utf-8"))


if __name__ == "__main__":
    profile(sys.argv[1])
