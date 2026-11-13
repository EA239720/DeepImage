import { useEffect, useState } from "react";
import { Grid } from "@chakra-ui/react";
import { ConfigPanel } from "./components/ConfigPanel";
import { FolderPrompt } from "./components/FolderPrompt";
import { ResultsPanel, type TabId } from "./components/ResultsPanel";
import { useBatch } from "./hooks/useBatch";
import { readFit, useSettings } from "./hooks/useSettings";
import { useSource } from "./hooks/useSource";
import { folderSummary, type FolderSummary } from "./lib/backend";

function App() {
  const [settings, update] = useSettings();
  const source = useSource(settings);
  const batch = useBatch();
  const [tab, setTab] = useState<TabId>("downloads");
  const [checking, setChecking] = useState(false);
  // What the destination folder holds while the user decides whether to keep it.
  const [existing, setExisting] = useState<FolderSummary | null>(null);

  // A file dropped anywhere but the images tab's drop area would replace the app with that file.
  useEffect(() => {
    const ignoreFiles = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", ignoreFiles);
    window.addEventListener("drop", ignoreFiles);
    return () => {
      window.removeEventListener("dragover", ignoreFiles);
      window.removeEventListener("drop", ignoreFiles);
    };
  }, []);

  const start = () => {
    setExisting(null);
    setTab("downloads");
    batch.start(source.tasks, { nameTpl: settings.nameTpl, outDir: settings.outDir, fit: readFit(settings).fit });
  };

  const requestStart = async () => {
    setChecking(true);
    // A folder that cannot be read is left for the download itself to report.
    const summary = await folderSummary(settings.outDir).catch(() => null);
    setChecking(false);
    if (summary && summary.files + summary.folders > 0) setExisting(summary);
    else start();
  };

  return (
    <Grid
      height="100vh"
      minH="620px"
      templateColumns="minmax(320px, 400px) minmax(0, 1fr)"
      templateRows="minmax(0, 1fr)"
      bg="linear-gradient(180deg, {colors.bg}, {colors.bg.panel})"
    >
      <ConfigPanel
        settings={settings}
        update={update}
        source={source}
        batch={batch}
        starting={checking || existing !== null}
        onStart={requestStart}
      />
      <ResultsPanel
        batch={batch}
        keyCount={source.keyCount}
        outDir={settings.outDir}
        tab={tab}
        onTab={setTab}
        onRetry={batch.retry}
      />
      {existing && (
        <FolderPrompt dir={settings.outDir} summary={existing} onProceed={start} onCancel={() => setExisting(null)} />
      )}
    </Grid>
  );
}

export default App;
