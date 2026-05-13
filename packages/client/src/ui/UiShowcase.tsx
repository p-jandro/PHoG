import { useState } from 'react';
import {
  Button, Input, Card, Chip, Pill, Tile, Avatar,
  LeaderboardRow, Countdown, ScoreDrop, ThemeToggle,
} from './index';

export function UiShowcase() {
  const [dropKey, setDropKey] = useState(0);

  return (
    <div className="min-h-screen bg-bg-base px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">

        <header className="flex items-center justify-between">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-ink-muted">UI Showcase</div>
            <h1 className="font-display text-4xl font-black tracking-tight">PHoG primitives</h1>
            <p className="mt-1 text-sm text-ink-muted">Visual smoke-check for every primitive. Toggle the theme top-right.</p>
          </div>
          <ThemeToggle />
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="action">Let's go</Button>
            <Button variant="info">Round 3</Button>
            <Button variant="streak">3× Streak</Button>
            <Button variant="premium">Final</Button>
            <Button variant="danger">Pass</Button>
            <Button variant="now">Your turn</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="action" disabled>Disabled</Button>
            <Button variant="action" loading>Submitting</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="action" size="sm">Submit</Button>
            <Button variant="action" size="md">Submit</Button>
            <Button variant="action" size="lg">Submit</Button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Your name" placeholder="e.g. Peter" helper="2–20 characters." />
            <Input label="Your name" defaultValue="Peter" helper="Focused on click." />
            <Input label="Your name" defaultValue="" error="Name is required." />
          </div>
        </Section>

        <Section title="Card + Chip + Pill">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card eyebrow="Round 3 of 5" title="Pointless: Capital cities">
              <div className="flex flex-wrap gap-2">
                <Chip>Default</Chip>
                <Chip variant="now">Your turn</Chip>
                <Chip variant="info">12 players</Chip>
                <Chip variant="streak">3× streak</Chip>
                <Chip variant="muted">Quiet</Chip>
              </div>
            </Card>
            <div className="flex flex-col gap-3">
              <Pill status="connected">Connected to game server</Pill>
              <Pill status="connecting">Connecting…</Pill>
              <Pill status="offline">Offline</Pill>
            </div>
          </div>
        </Section>

        <Section title="Tile">
          <div className="flex gap-2">
            <Tile state="idle">P</Tile>
            <Tile state="correct">L</Tile>
            <Tile state="partial">A</Tile>
            <Tile state="wrong">Y</Tile>
            <Tile state="correct">S</Tile>
          </div>
        </Section>

        <Section title="Avatar">
          <div className="flex flex-wrap gap-2">
            <Avatar name="Ana" />
            <Avatar name="Ben Wright" />
            <Avatar name="Cara" />
            <Avatar name="Dan" />
            <Avatar name="Eli" />
            <Avatar name="Peter Jandro" size="lg" />
          </div>
        </Section>

        <Section title="Leaderboard rows">
          <div className="flex flex-col gap-2">
            <LeaderboardRow rank={1} name="Ana" score={340} delta={80} />
            <LeaderboardRow rank={2} name="You · Peter" score={280} delta={40} isYou />
            <LeaderboardRow rank={3} name="Cara" score={220} delta={-20} />
            <LeaderboardRow rank={4} name="Ben" score={200} />
          </div>
        </Section>

        <Section title="Countdown">
          <Countdown seconds={3} total={3} />
        </Section>

        <Section title="ScoreDrop (Pointless)">
          <div className="flex items-start gap-6">
            <ScoreDrop key={dropKey} targetScore={8} />
            <Button variant="info" size="sm" onClick={() => setDropKey(k => k + 1)}>
              Replay drop
            </Button>
          </div>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t-2 border-ink/10 pt-6">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
