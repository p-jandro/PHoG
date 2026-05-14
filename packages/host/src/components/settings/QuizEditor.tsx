import { Socket } from 'socket.io-client';

interface Props { socket: Socket | null; }

export const QuizEditor = ({ socket: _socket }: Props) => (
  <div className="rounded-2xl border-2 border-ink bg-bg-surface p-6 shadow-ink-sm">
    <p className="text-ink-muted">Quiz editor — implemented in Task 8.</p>
  </div>
);
