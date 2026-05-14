import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { Button, HostScreenShell } from '../ui';
import { QuizEditor } from '../components/settings/QuizEditor';
import { TrueFalseEditor } from '../components/settings/TrueFalseEditor';
import { PointlessEditor } from '../components/settings/PointlessEditor';

type Tab = 'quiz' | 'trueFalse' | 'pointless';

interface SettingsProps {
  socket: Socket | null;
  onClose: () => void;
}

export const Settings = ({ socket, onClose }: SettingsProps) => {
  const [tab, setTab] = useState<Tab>('quiz');

  return (
    <HostScreenShell location="Host · Settings" topRight={{ kind: 'theme-toggle' }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['quiz', 'trueFalse', 'pointless'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={[
                  'rounded-2xl border-2 border-ink px-4 py-2 text-sm font-extrabold uppercase tracking-[0.14em] shadow-ink-sm',
                  tab === t ? 'bg-streak text-on-streak' : 'bg-bg-surface text-ink'
                ].join(' ')}
              >
                {t === 'quiz' ? 'Quiz' : t === 'trueFalse' ? 'True/False' : 'Pointless'}
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={onClose}>← Back to Dashboard</Button>
        </div>

        {tab === 'quiz' && <QuizEditor socket={socket} />}
        {tab === 'trueFalse' && <TrueFalseEditor socket={socket} />}
        {tab === 'pointless' && <PointlessEditor socket={socket} />}
      </div>
    </HostScreenShell>
  );
};
