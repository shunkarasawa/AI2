import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { useSession } from './hooks/useSession';
import { summarize } from './lib/stats';
import {
  loadConfig,
  loadSessions,
  loadSettings,
  saveConfig,
  saveSessions,
  saveSettings,
  type Backup,
  type SessionConfig,
  type SessionRecord,
  type Settings as SettingsShape,
} from './lib/storage';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Stats } from './screens/Stats';

/** これより短いものは記録しない（誤タップ・確認のための開始を残さないため） */
const MIN_RECORD_SEC = 30;
const TOAST_MS = 2200;

export function App() {
  const [sessions, setSessions] = useState<SessionRecord[]>(loadSessions);
  const [settings, setSettings] = useState<SettingsShape>(loadSettings);
  const [config, setConfig] = useState<SessionConfig>(loadConfig);
  const [tab, setTab] = useState<Tab>('home');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => saveSessions(sessions), [sessions]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveConfig(config), [config]);

  // テーマの適用。system のときは OS の設定に追従する
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = settings.theme === 'light' || (settings.theme === 'system' && media.matches);
      document.documentElement.dataset.theme = light ? 'light' : 'dark';
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute('content', light ? '#f7f6f2' : '#0b0e13');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  const notify = useCallback((message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const onFinish = useCallback((record: SessionRecord, completed: boolean) => {
    if (!completed && record.durationSec < MIN_RECORD_SEC) return;
    setSessions((prev) => [...prev, record]);
  }, []);

  const engine = useSession({ config, settings, onFinish });

  const summary = useMemo(() => summarize(sessions), [sessions]);

  const patchConfig = useCallback(
    (patch: Partial<SessionConfig>) => setConfig((prev) => ({ ...prev, ...patch })),
    [],
  );
  const patchSettings = useCallback(
    (patch: Partial<SettingsShape>) => setSettings((prev) => ({ ...prev, ...patch })),
    [],
  );

  const importBackup = useCallback((backup: Backup) => {
    setSessions(backup.sessions);
    setSettings(backup.settings);
    setConfig(backup.config);
  }, []);

  const resetAll = useCallback(() => setSessions([]), []);

  const inSession = engine.state !== 'idle';

  return (
    <div className="app">
      {tab === 'home' ? (
        <Home
          config={config}
          settings={settings}
          summary={summary}
          onConfig={patchConfig}
          onStart={() => void engine.start()}
        />
      ) : null}
      {tab === 'stats' ? <Stats sessions={sessions} /> : null}
      {tab === 'settings' ? (
        <Settings
          settings={settings}
          config={config}
          sessions={sessions}
          onSettings={patchSettings}
          onImport={importBackup}
          onReset={resetAll}
          notify={notify}
        />
      ) : null}

      <TabBar tab={tab} onChange={setTab} />

      {inSession ? (
        <Session config={config} settings={settings} engine={engine} onClose={engine.reset} />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
