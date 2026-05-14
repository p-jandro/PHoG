/**
 * Per bug-report 2026-05-14 §A4: the per-round leaderboard pop between every
 * question/statement has been removed. The server no longer emits the round
 * payload (see gameEngine.js `showRoundLeaderboard`), and this overlay now
 * always renders nothing.
 *
 * The component is kept as an exported no-op so existing imports in
 * App.tsx / per-screen layouts don't have to be touched.
 */
export const RoundLeaderboardOverlay = () => null;
