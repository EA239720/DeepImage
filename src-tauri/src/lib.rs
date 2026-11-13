mod download;
mod folder;
mod reshape;

use std::path::Path;

use download::{DownloadError, Outcome};
use folder::FolderSummary;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

/// Downloads one URL into `dir`, naming the file `stem` plus the image's extension, and
/// crops or resizes it first when `fit` asks for it.
#[tauri::command]
async fn download_image(
    client: tauri::State<'_, reqwest::Client>,
    url: String,
    dir: String,
    stem: String,
    fit: Option<reshape::Fit>,
) -> Result<Outcome, DownloadError> {
    download::fetch_image(&client, &url, Path::new(&dir), &stem, fit).await
}

/// Shows `dir` in the system file manager.
#[tauri::command]
fn open_folder(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    app.opener()
        .open_path(dir, None::<&str>)
        .map_err(|err| err.to_string())
}

/// Counts what `dir` already holds, so the user can decide what to do with it.
#[tauri::command]
async fn folder_summary(dir: String) -> Result<FolderSummary, String> {
    tauri::async_runtime::spawn_blocking(move || folder::summarize(Path::new(&dir)))
        .await
        .map_err(|err| err.to_string())?
        .map_err(|err| err.to_string())
}

/// Moves the contents of `dir` to the system trash and returns how many entries went.
#[tauri::command]
async fn clear_folder(app: tauri::AppHandle, dir: String) -> Result<usize, String> {
    let dir = Path::new(&dir).to_path_buf();
    // Emptying one of these would take far more than a batch of images with it.
    let is_home = app.path().home_dir().is_ok_and(|home| home == dir);
    if dir.parent().is_none() || is_home {
        return Err(format!(
            "No se vacía {}: elige una carpeta dedicada a las descargas.",
            dir.display()
        ));
    }
    tauri::async_runtime::spawn_blocking(move || folder::clear(&dir))
        .await
        .map_err(|err| err.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(download::http_client())
        .invoke_handler(tauri::generate_handler![
            download_image,
            open_folder,
            folder_summary,
            clear_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
