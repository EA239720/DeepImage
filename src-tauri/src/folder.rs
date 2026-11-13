use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Files the operating system drops into folders on its own; they are neither counted nor removed.
const OS_METADATA: [&str; 3] = [".DS_Store", "Thumbs.db", "desktop.ini"];

/// What a destination folder already holds, at its top level.
#[derive(Debug, Default, PartialEq, Serialize)]
pub struct FolderSummary {
    files: usize,
    folders: usize,
}

/// Top-level entries of `dir` with whether each is a folder. A missing folder has none.
fn entries(dir: &Path) -> std::io::Result<Vec<(PathBuf, bool)>> {
    let reader = match std::fs::read_dir(dir) {
        Ok(reader) => reader,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(err),
    };
    let mut found = Vec::new();
    for entry in reader {
        let entry = entry?;
        if OS_METADATA.iter().any(|name| entry.file_name() == *name) {
            continue;
        }
        // A link to a folder counts as a file: removing it leaves its target alone.
        found.push((entry.path(), entry.file_type()?.is_dir()));
    }
    Ok(found)
}

pub fn summarize(dir: &Path) -> std::io::Result<FolderSummary> {
    let entries = entries(dir)?;
    let folders = entries.iter().filter(|(_, is_dir)| *is_dir).count();
    Ok(FolderSummary {
        files: entries.len() - folders,
        folders,
    })
}

/// Moves everything inside `dir` to the system trash, keeping the folder itself.
/// Returns how many entries were moved.
pub fn clear(dir: &Path) -> Result<usize, String> {
    clear_with(dir, move_to_trash)
}

fn clear_with(
    dir: &Path,
    remove: impl FnOnce(&[PathBuf]) -> Result<(), String>,
) -> Result<usize, String> {
    let paths: Vec<PathBuf> = entries(dir)
        .map_err(|err| err.to_string())?
        .into_iter()
        .map(|(path, _)| path)
        .collect();
    if !paths.is_empty() {
        remove(&paths)?;
    }
    Ok(paths.len())
}

fn move_to_trash(paths: &[PathBuf]) -> Result<(), String> {
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::new();
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        // The default scripts Finder, which asks the user for automation access.
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context.delete_all(paths).map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lote-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn populate(dir: &Path) {
        fs::write(dir.join("CA-100.MAIN.jpg"), b"a").unwrap();
        fs::write(dir.join("CA-101.MAIN.jpg"), b"b").unwrap();
        fs::write(dir.join(".DS_Store"), b"").unwrap();
        fs::create_dir(dir.join("anteriores")).unwrap();
        fs::write(dir.join("anteriores").join("vieja.jpg"), b"c").unwrap();
    }

    #[test]
    fn a_missing_folder_is_empty() {
        let dir = scratch_dir("missing").join("no-existe");
        assert_eq!(summarize(&dir).unwrap(), FolderSummary::default());
        assert_eq!(clear_with(&dir, |_| panic!("nothing to remove")).unwrap(), 0);
    }

    #[test]
    fn counts_top_level_entries_without_os_metadata() {
        let dir = scratch_dir("summary");
        populate(&dir);
        assert_eq!(summarize(&dir).unwrap(), FolderSummary { files: 2, folders: 1 });
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn clearing_removes_every_entry_but_keeps_the_folder() {
        let dir = scratch_dir("clear");
        populate(&dir);

        let mut removed = Vec::new();
        let count = clear_with(&dir, |paths| {
            removed = paths.to_vec();
            Ok(())
        })
        .unwrap();

        removed.sort();
        assert_eq!(count, 3);
        assert_eq!(
            removed,
            [
                dir.join("CA-100.MAIN.jpg"),
                dir.join("CA-101.MAIN.jpg"),
                dir.join("anteriores"),
            ]
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failed_removal_is_reported() {
        let dir = scratch_dir("failure");
        populate(&dir);
        let result = clear_with(&dir, |_| Err("sin permiso".to_string()));
        assert_eq!(result, Err("sin permiso".to_string()));
        fs::remove_dir_all(&dir).unwrap();
    }

    /// Ignored by default: it leaves its scratch files in the real system trash.
    #[test]
    #[ignore]
    fn clearing_moves_entries_to_the_system_trash() {
        let dir = scratch_dir("papelera");
        populate(&dir);

        assert_eq!(clear(&dir).unwrap(), 3);

        let left: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(left, [".DS_Store"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
