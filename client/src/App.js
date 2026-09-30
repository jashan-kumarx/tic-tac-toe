import { Looper } from './codehook/index.js';
import React, { useState, useEffect, useRef, useCallback } from "react";
import Board from "./components/Board";
import AiEmailPanel from "./components/AiEmailPanel";
import { parseScores, describeScoreError } from "./lib/scores.mjs";

const App = () => {
  const [history, setHistory] = useState([
    {
      squares: Array(9).fill(null),
    },
  ]);
  const [currentMove, setCurrentMove] = useState(0);
  // Saved results from the PostgreSQL score API (server/index.js).
  const [scores, setScores] = useState([]);
  const [dbError, setDbError] = useState(null);
  const recordedRef = useRef(false);
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove].squares;

  // Calculate winner and winning line
  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (
        squares[a] &&
        squares[a] === squares[b] &&
        squares[a] === squares[c]
      ) {
        return {
          winner: squares[a],
          line: lines[i],
        };
      }
    }
    return null;
  };

  const handleClick = (i) => {
    // If square is already filled or game is won, ignore click
    if (currentSquares[i] || calculateWinner(currentSquares)) {
      return;
    }

    const nextSquares = currentSquares.slice();
    nextSquares[i] = xIsNext ? "X" : "O";
    recordedRef.current = false; // a new move means this position isn't saved yet

    // Create new history up to current move and add new move
    const nextHistory = [
      ...history.slice(0, currentMove + 1),
      { squares: nextSquares },
    ];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  };

  const jumpTo = (move) => {
    setCurrentMove(move);
  };

  const restartGame = () => {
    setHistory([{ squares: Array(9).fill(null) }]);
    setCurrentMove(0);
    recordedRef.current = false;
  };

  // Determine game status
  const winnerInfo = calculateWinner(currentSquares);
  const winner = winnerInfo?.winner;
  const winningLine = winnerInfo?.line;
  const isDraw = !winner && currentSquares.every((square) => square !== null);

  // Never trust the payload's shape: after a database reset the API answers
  // 503 + { error }, and putting that object in state crashed the game with
  // "scores.map is not a function" — the board became unplayable.
  const refreshScores = useCallback(() => {
    (async () => {
      let result;
      try {
        const r = await fetch("/api/scores");
        const body = await r.json().catch(() => null);
        result = parseScores(r.ok, body);
      } catch {
        result = parseScores(false, null);
      }
      setScores(result.scores);
      setDbError(result.error);
    })();
  }, []);

  useEffect(refreshScores, [refreshScores]);

  // A5 test: one agent, two code hooks — each button must run only its own branch.
  const [agentMessage, setAgentMessage] = useState(null);
  const callHook = (hookId) => {
    Looper.automation.codeHook('/api/agents/b833acdd-fcd6-4732-83a9-8ecc12b8743b/code-hook/YOUR_HOOK_TOKEN/' + hookId + '?devSessionId=YOUR_DEV_SESSION_ID', { from: 'button ' + hookId }, (err) => {
      if (err) console.error(err);
    }, (err, result) => {
      if (err) return console.error(err);
      console.log(hookId, result);
      setAgentMessage(typeof result === 'string' ? result : JSON.stringify(result));
    });
  };

  // Record each finished game once into the PostgreSQL score API (best-effort).
  const gameOver = Boolean(winner) || isDraw;
  useEffect(() => {
    if (!gameOver || recordedRef.current) return;
    recordedRef.current = true;
    (async () => {
      try {
        const r = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winner: winner || "draw" }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => null);
          // Let a later finished game retry — the row was never written.
          recordedRef.current = false;
          setDbError(describeScoreError(body));
          return;
        }
        refreshScores();
        Looper.automation.codeHook('/api/agents/14c4a04a-5813-4766-91b8-64c6ff8c04d4/code-hook/YOUR_HOOK_TOKEN/hook-ch-19?devSessionId=YOUR_DEV_SESSION_ID', { winner: '...' }, (err, run) => {
  // Fires once the run is queued, then again on each poll while it's running — NOT the flow's result yet.
  if (err) console.error(err);
}, (err, result) => {
  // Fires once the flow actually finishes running.
  if (err) return console.error(err);
  console.log(result);
});
      } catch {
        recordedRef.current = false;
        setDbError(describeScoreError(null));
      }
    })();
  }, [gameOver, winner, refreshScores]);

  // Defensive: whatever happens upstream, the render only ever maps an array.
  const scoreList = Array.isArray(scores) ? scores : [];

  let status;
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (isDraw) {
    status = "It's a Draw!";
  } else {
    status = `Next player: ${xIsNext ? "X" : "O"}`;
  }

  // Generate move history list
  const moves = history.map((step, move) => {
    const description = move > 0 ? `Go to move #${move}` : "Go to game start";
    return (
      <li key={move}>
        <button
          onClick={() => jumpTo(move)}
          className={move === currentMove ? "current-move" : ""}>
          {description}
        </button>
      </li>
    );
  });

  return (
    <div className="game">
      <div className="game-header">
        <h1>Tic Tac Toe</h1>
      </div>
      <div className="game-container">
        <div className="game-board">
          <div className="status">{status}</div>
          <Board
            squares={currentSquares}
            onClick={handleClick}
            winningLine={winningLine}
          />
          <button className="restart-button" onClick={restartGame}>
            Restart Game
          </button>
          <div className="hook-buttons" data-cmp="game.hook-buttons_wrap">
            <button data-cmp="game.hook-a_button" onClick={() => callHook('hook-a')}>Call hook A</button>
            <button data-cmp="game.hook-b_button" onClick={() => callHook('hook-b')}>Call hook B</button>
          </div>
          {agentMessage && (
            <p className="agent-message" data-cmp="game.agent-message_text">{agentMessage}</p>
          )}
          <AiEmailPanel
            squares={currentSquares}
            next={xIsNext ? "X" : "O"}
            gameOver={gameOver}
            result={winner || (isDraw ? "draw" : null)}
            moves={currentMove}
          />
        </div>
        <div className="game-info">
          <h3>Move History</h3>
          <ol>{moves}</ol>
          <h3 data-cmp="ttt.scores_title">Saved Results (PostgreSQL)</h3>
          {dbError ? (
            <p className="db-error" data-cmp="ttt.scores_error">{dbError}</p>
          ) : scoreList.length === 0 ? (
            <p data-cmp="ttt.scores_empty">No games recorded yet.</p>
          ) : (
            <ol data-cmp="ttt.scores_list">
              {scoreList.map((s) => (
                <li key={s.id}>
                  {s.winner === "draw" ? "Draw" : `${s.winner} won`} — {s.played_at}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
