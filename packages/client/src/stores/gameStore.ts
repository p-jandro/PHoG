import { create } from 'zustand';

export interface RoundLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  score: number;
  connected: boolean;
  streak?: number;
  rankDelta?: number | null;
}

export interface RoundLeaderboardState {
  game: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | 'wordle' | 'travel';
  duration: number;
  leaderboard: RoundLeaderboardEntry[];
  roundNumber?: number | null;
  totalRounds?: number | null;
  unitLabel?: string;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  currentGameScore: number;
  totalPlacementScore: number;
  placements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
    pokedle: number | null;
    hpdle: number | null;
    numbers: number | null;
    wordle: number | null;
    travel: number | null;
  };
  gamePlacements?: {
    quiz: number | null;
    trueFalse: number | null;
    countdown: number | null;
    pointless: number | null;
    pokedle: number | null;
    hpdle: number | null;
    numbers: number | null;
    wordle: number | null;
    travel: number | null;
  };
  totalPlacement?: number;
  connected: boolean;
}

export interface GameState {
  // Connection state
  connected: boolean;
  connectionError: string | null;
  
  // Player state
  playerId: string | null;
  playerName: string | null;
  reconnectToken: string | null;
  
  // Game state
  phase: 'lobby' | 'playing' | 'leaderboard' | 'finished';
  currentGame: 'quiz' | 'trueFalse' | 'countdown' | 'pointless' | 'pokedle' | 'hpdle' | 'numbers' | 'wordle' | 'travel' | null;
  players: Player[];
  paused: boolean;
  roundLeaderboard: RoundLeaderboardState | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setPlayer: (id: string, name: string, token: string) => void;
  setPhase: (phase: GameState['phase']) => void;
  setCurrentGame: (game: GameState['currentGame']) => void;
  setPlayers: (players: Player[]) => void;
  updatePlayer: (player: Player) => void;
  setPaused: (paused: boolean) => void;
  setRoundLeaderboard: (roundLeaderboard: RoundLeaderboardState | null) => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  connectionError: null,
  playerId: null,
  playerName: null,
  reconnectToken: null,
  phase: 'lobby' as const,
  currentGame: null,
  players: [],
  paused: false,
  roundLeaderboard: null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected, connectionError: connected ? null : undefined }),
  
  setConnectionError: (error) => set({ connectionError: error }),
  
  setPlayer: (id, name, token) => set({ 
    playerId: id, 
    playerName: name, 
    reconnectToken: token 
  }),
  
  setPhase: (phase) => set({ phase }),
  
  setCurrentGame: (game) => set({ currentGame: game }),
  
  setPlayers: (players) => set({ players }),
  
  updatePlayer: (player) => set((state) => ({
    players: state.players.map(p => p.id === player.id ? player : p)
  })),

  setPaused: (paused) => set({ paused }),

  setRoundLeaderboard: (roundLeaderboard) => set({ roundLeaderboard }),

  reset: () => set(initialState),
}));
