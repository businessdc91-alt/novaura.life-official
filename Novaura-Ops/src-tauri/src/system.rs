use serde::Serialize;
use sysinfo::{System, SystemExt, CpuExt, DiskExt};
use tauri::command;

#[derive(Serialize)]
pub struct ResourceUsage {
    pub cpu_percent: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub memory_percent: f32,
    pub disk_used_gb: f64,
    pub disk_total_gb: f64,
    pub disk_percent: f32,
    pub uptime_secs: u64,
}

#[command]
pub async fn get_resource_usage() -> Result<ResourceUsage, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu = sys.global_cpu_info().cpu_usage();
    let mem_used = sys.used_memory() / 1024 / 1024;
    let mem_total = sys.total_memory() / 1024 / 1024;
    let mem_pct = if mem_total > 0 { mem_used as f32 / mem_total as f32 * 100.0 } else { 0.0 };

    let (disk_used, disk_total) = sys.disks().iter().fold((0u64, 0u64), |acc, d| {
        (acc.0 + d.total_space() - d.available_space(), acc.1 + d.total_space())
    });

    Ok(ResourceUsage {
        cpu_percent: cpu,
        memory_used_mb: mem_used,
        memory_total_mb: mem_total,
        memory_percent: mem_pct,
        disk_used_gb: disk_used as f64 / 1e9,
        disk_total_gb: disk_total as f64 / 1e9,
        disk_percent: if disk_total > 0 { disk_used as f32 / disk_total as f32 * 100.0 } else { 0.0 },
        uptime_secs: sys.uptime(),
    })
}
