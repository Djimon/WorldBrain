#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    migrate_legacy_app_data();
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

/// One-time data migration for the "WorldBuilderX" -> "Worlds and Beyond" rebrand.
///
/// The Tauri identifier drives the per-app data directory (`%APPDATA%\<identifier>`),
/// where all projects, themes and player tokens live. Renaming the identifier from
/// `com.worldbuilderx.desktop` to `WorldsAndBeyond` would otherwise orphan that data.
///
/// This runs as the very first thing in `run()` — before the app (and thus the webview
/// data dir) is created — so the destination does not exist yet and a single atomic
/// rename moves the whole folder. Idempotent and best-effort: once migrated (or on a
/// fresh install) the guard makes it a no-op. Failure is non-fatal (the app just starts
/// with an empty data dir, exactly as a fresh install would).
#[cfg(windows)]
fn migrate_legacy_app_data() {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let base = std::path::Path::new(&appdata);
        let legacy = base.join("com.worldbuilderx.desktop");
        let current = base.join("WorldsAndBeyond");
        if legacy.is_dir() && !current.exists() {
            let _ = std::fs::rename(&legacy, &current);
        }
    }
}

#[cfg(not(windows))]
fn migrate_legacy_app_data() {}
