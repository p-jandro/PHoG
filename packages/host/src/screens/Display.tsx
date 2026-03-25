import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

interface Player {
  id: string;
  name: string;
  score: number;
  connected: boolean;
}

export const Display = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<string>('lobby');
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

  // Quiz state
  const [quizVoting, setQuizVoting] = useState<any>(null);
  const [quizQuestion, setQuizQuestion] = useState<any>(null);

  // True/False state
  const [tfStatement, setTfStatement] = useState<any>(null);

  // Countdown state
  const [countdownRound, setCountdownRound] = useState<any>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      autoConnect: true
    });

    newSocket.on('connect', () => {
      console.log('[Display] Connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[Display] Disconnected');
      setConnected(false);
    });

    // Heartbeat
    newSocket.on('ping', () => {
      newSocket.emit('pong');
    });

    // Game state events
    newSocket.on('players:update', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('phase:change', ({ phase }) => {
      setPhase(phase);
    });

    newSocket.on('game:start', ({ game }) => {
      setCurrentGame(game);
      setPhase('playing');
    });

    // Quiz events
    newSocket.on('quiz:voting:start', (data) => {
      setQuizVoting(data);
      setQuizQuestion(null);
    });

    newSocket.on('quiz:voting:end', () => {
      setQuizVoting(null);
    });

    newSocket.on('quiz:question:start', (data) => {
      setQuizQuestion(data);
    });

    newSocket.on('quiz:question:end', () => {
      setQuizQuestion(null);
    });

    // True/False events
    newSocket.on('truefalse:statement', (data) => {
      setTfStatement(data);
    });

    newSocket.on('truefalse:answer', () => {
      setTfStatement(null);
    });

    // Countdown events
    newSocket.on('countdown:round:start', (data) => {
      setCountdownRound(data);
    });

    newSocket.on('countdown:round:end', () => {
      setCountdownRound(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Lobby View
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-navy via-ui-background to-primary-navy flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-4xl w-full"
        >
          <h1 className="text-8xl font-bold mb-6 text-white">
            PHoG
          </h1>
          <p className="text-4xl text-ui-textMuted mb-12">
            Peter's House of Games
          </p>

          <div className="bg-white p-4 rounded-xl inline-block mb-8">
            <QRCodeSVG
              value={`${window.location.protocol}//${window.location.hostname}:5173`}
              size={256}
              level="H"
              includeMargin={true}
            />
            <p className="text-black font-bold mt-2 text-xl">Scan to Join</p>
          </div>

          <div className="card p-8 mb-8">
            <h2 className="text-3xl font-bold mb-6">
              Players Ready: {players.filter(p => p.connected).length}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {players.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-ui-background rounded-lg border-2 border-game-correct"
                >
                  <p className="text-xl font-medium truncate">{player.name}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-2xl text-ui-textMuted"
          >
            Waiting for host to start game...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Quiz Voting View
  if (currentGame === 'quiz' && quizVoting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-navy to-primary-blue flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-6xl w-full"
        >
          <h1 className="text-6xl font-bold mb-8">Vote for Category</h1>
          <p className="text-3xl text-ui-textMuted mb-12">
            Question {quizVoting.questionNumber} of {quizVoting.totalQuestions}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {quizVoting.categories.map((category: any) => (
              <motion.div
                key={category.id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="card p-12 text-center"
                style={{ backgroundColor: category.color }}
              >
                <p className="text-4xl font-bold text-white">{category.name}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Quiz Question View
  if (currentGame === 'quiz' && quizQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-navy to-primary-blue flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-6xl w-full"
        >
          <div className="mb-8">
            <span className="text-2xl text-ui-textMuted">
              Question {quizQuestion.questionNumber} of {quizQuestion.totalQuestions}
            </span>
            <span
              className="ml-4 text-2xl font-bold px-4 py-2 rounded-full"
              style={{ backgroundColor: quizQuestion.category === 'easy' ? '#00D4AA' : quizQuestion.category === 'medium' ? '#0066FF' : quizQuestion.category === 'hard' ? '#FFA502' : '#FF4757', color: 'white' }}
            >
              {quizQuestion.category.toUpperCase()}
            </span>
          </div>

          <div className="card p-12 mb-8">
            <h2 className="text-5xl font-bold">{quizQuestion.question}</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {Object.entries(quizQuestion.answers).map(([key, value]: [string, any]) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * ['A', 'B', 'C', 'D'].indexOf(key) }}
                className="card p-8 text-left"
                style={{
                  backgroundColor: {
                    A: '#0066FF',
                    B: '#00D4AA',
                    C: '#FFA502',
                    D: '#7B61FF'
                  }[key]
                }}
              >
                <div className="text-3xl font-bold text-white opacity-75 mb-2">{key}</div>
                <div className="text-3xl text-white">{value}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // True/False View
  if (currentGame === 'trueFalse' && tfStatement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-teal to-primary-navy flex flex-col items-center justify-center p-8">
        <motion.div
          key={tfStatement.statementId}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-5xl w-full"
        >
          <div className="mb-8">
            <span className="text-3xl text-ui-textMuted">
              Statement {tfStatement.statementNumber} of {tfStatement.totalStatements}
            </span>
          </div>

          <div className="card p-16">
            <h2 className="text-6xl font-bold">{tfStatement.statement}</h2>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="card p-12 bg-game-incorrect">
              <p className="text-5xl font-bold text-white">FALSE</p>
            </div>
            <div className="card p-12 bg-game-correct">
              <p className="text-5xl font-bold text-white">TRUE</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Countdown View
  if (currentGame === 'countdown' && countdownRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-purple to-primary-navy flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-6xl w-full"
        >
          <div className="mb-8">
            <span className="text-3xl text-ui-textMuted">
              Round {countdownRound.roundNumber} of {countdownRound.totalRounds}
            </span>
          </div>

          <div className="card p-12 mb-8">
            <h2 className="text-5xl font-bold mb-8">Make the longest word!</h2>
            <div className="flex justify-center gap-4 flex-wrap">
              {countdownRound.letters.map((letter: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="w-20 h-20 flex items-center justify-center text-5xl font-bold bg-primary-purple text-white rounded-lg"
                >
                  {letter}
                </motion.div>
              ))}
            </div>
          </div>

          <p className="text-2xl text-ui-textMuted">
            Players have 30 seconds to form a word
          </p>
        </motion.div>
      </div>
    );
  }

  // Default/Generic View
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-navy to-ui-background flex flex-col items-center justify-center p-8">
      <div className="text-center">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <h1 className="text-6xl font-bold mb-4">PHoG Display</h1>
          <p className="text-2xl text-ui-textMuted">
            {connected ? 'Connected to server' : 'Connecting...'}
          </p>
          <p className="text-xl text-ui-textMuted mt-4">
            Phase: {phase} | Game: {currentGame || 'None'}
          </p>
        </motion.div>
      </div>
    </div>
  );
};

