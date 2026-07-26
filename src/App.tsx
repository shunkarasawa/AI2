import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabBar, type Tab } from './components/TabBar';
import { useSession } from './hooks/useSession';
import { summarize } from './lib/stats';
import {
  isWorthRecording,
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

const TOAST_MS = 2200;

const TAB_TITLE: Record<Tab, string> = { home: '瞑想', stats: '記録', settings: '設定' };

export function App() {
  const [sessions, setSessions] = useState<SessionRecord[]>(loadSessions);
  const [settings, setSettings] = useState<SettingsShape>(loadSettings);
  const [config, setConfig] = useState<SessionConfig>(loadConfig);
  const [tab, setTab] = useState<Tab>('home');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => saveSessions(sessions), [sessions]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => saveConfig(config), [config]);

  // テーマの適用。system のときは OS の設定に追従する
  // （初回ペイント前の適用は index.html のインラインスクリプトが担当）
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

  const onFinish = useCallback((record: SessionRecord) => {
    // 完走したかどうかに関わらず、短すぎるものは残さない
    if (!isWorthRecording(record.durationSec)) return;
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

  // タブを変えたら見出しの器にフォーカスを移す。
  // ルーティングを持たないので、これがないと読み上げ環境で画面が変わったことに気づけない
  const changeTab = useCallback((next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => mainRef.current?.focus());
  }, []);

  const inSession = engine.state !== 'idle';

  return (
    <div className="app">
      {/* セッション中は背後を inert にする。これがないと Tab の1回目で
          見えないタブボタンに乗り、Enter で裏の画面が切り替わってしまう */}
      <div className="app-body" inert={inSession}>
        <main ref={mainRef} tabIndex={-1} aria-label={TAB_TITLE[tab]} className="app-main">
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
        </main>

        <TabBar tab={tab} onChange={changeTab} />
      </div>

      {inSession ? (
        <Session config={config} settings={settings} engine={engine} onClose={engine.reset} />
      ) : null}

      {/* リージョンは常設し中身だけ差し替える。挿入と同時だと初回が読まれないことがある */}
      <div className="visually-hidden" role="status">
        {toast ?? ''}
      </div>
      {toast ? (
        <div className="toast" aria-hidden="true">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
