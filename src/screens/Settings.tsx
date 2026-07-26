import { useRef } from 'react';
import { playBell } from '../audio/bell';
import { unlockAudio } from '../audio/context';
import { IconDownload, IconUpload } from '../components/icons';
import { Section, Segmented, SliderRow, SwitchRow } from '../components/ui';
import { canVibrate, haptics } from '../lib/haptics';
import {
  BELL_TONES,
  buildBackup,
  parseBackup,
  type Backup,
  type SessionConfig,
  type SessionRecord,
  type Settings as SettingsShape,
} from '../lib/storage';
import { dayKey } from '../lib/time';

interface Props {
  settings: SettingsShape;
  config: SessionConfig;
  sessions: SessionRecord[];
  onSettings: (patch: Partial<SettingsShape>) => void;
  onImport: (backup: Backup) => void;
  onReset: () => void;
  notify: (message: string) => void;
}

export function Settings({
  settings,
  config,
  sessions,
  onSettings,
  onImport,
  onReset,
  notify,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const vibrateSupported = canVibrate();

  const exportData = () => {
    const backup = buildBackup(sessions, settings, config);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `shizuka-${dayKey(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('書き出しました');
  };

  const importData = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const backup = parseBackup(String(reader.result ?? ''));
      if (!backup) {
        notify('読み込めませんでした');
        return;
      }
      onImport(backup);
      notify(`${backup.sessions.length}件を読み込みました`);
    };
    reader.onerror = () => notify('読み込めませんでした');
    reader.readAsText(file);
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">設定</h1>
      </header>

      <Section title="見た目">
        <Segmented
          label="テーマ"
          value={settings.theme}
          onChange={(theme) => onSettings({ theme })}
          options={[
            { value: 'system', label: '自動' },
            { value: 'dark', label: '暗い' },
            { value: 'light', label: '明るい' },
          ]}
        />
        <div className="card card-pad" style={{ marginTop: '0.75rem' }}>
          <SwitchRow
            title="秒数を表示する"
            desc="呼吸の残り秒数を円の下に出します。数字が気になるなら切ってください"
            checked={settings.showCountdown}
            onChange={(showCountdown) => onSettings({ showCountdown })}
          />
        </div>
      </Section>

      <Section title="音">
        <div className="card card-pad">
          <SliderRow
            title="ベルの音量"
            value={settings.bellVolume}
            onChange={(bellVolume) => onSettings({ bellVolume })}
          />
          <div className="row">
            <div className="row-body">
              <div className="row-title">鳴らしてみる</div>
              <div className="row-desc">開始のボウルの音を確認します</div>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void unlockAudio().then(() => playBell(BELL_TONES.start, settings.bellVolume));
              }}
            >
              試す
            </button>
          </div>
          <SliderRow
            title="環境音の音量"
            value={settings.ambientVolume}
            onChange={(ambientVolume) => onSettings({ ambientVolume })}
          />
        </div>
      </Section>

      <Section title="セッション中">
        <div className="card card-pad">
          <SwitchRow
            title="画面を消さない"
            desc="セッション中だけ自動ロックを止めます（対応している端末のみ）"
            checked={settings.keepAwake}
            onChange={(keepAwake) => onSettings({ keepAwake })}
          />
          <SwitchRow
            title="切り替わりで振動する"
            desc={
              vibrateSupported
                ? '吸う・吐くが変わるときに短く振動します'
                : 'この端末（またはブラウザ）は振動に対応していません'
            }
            checked={settings.haptics && vibrateSupported}
            disabled={!vibrateSupported}
            onChange={(next) => {
              onSettings({ haptics: next });
              if (next) haptics.phase();
            }}
          />
        </div>
      </Section>

      <Section title="データ" note={`${sessions.length}件`}>
        <div className="card card-pad">
          <div className="row">
            <div className="row-body">
              <div className="row-title">書き出す</div>
              <div className="row-desc">記録と設定を JSON で保存します</div>
            </div>
            <button type="button" className="ghost" onClick={exportData}>
              <IconDownload />
              書き出し
            </button>
          </div>
          <div className="row">
            <div className="row-body">
              <div className="row-title">読み込む</div>
              <div className="row-desc">書き出した JSON で置き換えます</div>
            </div>
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
              <IconUpload />
              読み込み
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="file-input"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) importData(file);
                e.currentTarget.value = '';
              }}
            />
          </div>
          <div className="row">
            <div className="row-body">
              <div className="row-title">すべて消す</div>
              <div className="row-desc">元に戻せません</div>
            </div>
            <button
              type="button"
              className="ghost danger"
              onClick={() => {
                if (window.confirm('記録をすべて消します。元に戻せません。')) {
                  onReset();
                  notify('消しました');
                }
              }}
            >
              消す
            </button>
          </div>
        </div>
      </Section>

      <p className="about">
        静か — 瞑想と呼吸のためのアプリ。
        <br />
        記録はこの端末の localStorage にだけ保存されます。サーバーには何も送りません。
        <br />
        ベルと環境音はファイルではなく、その場で合成しています。だから機内モードでも鳴ります。
        <br />
        ホーム画面に追加すると、アプリとして開けます。
      </p>
    </div>
  );
}
