import React, { useState, useEffect, useRef, useCallback } from "react";
import Board from "./components/Board";

const App = () => {
  const [history, setHistory] = useState([
    {
      squares: Array(9).fill(null),
    },
  ]);
  const [currentMove, setCurrentMove] = useState(0);
  // Saved results from the SQLite score API (server/index.js).
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

  const refreshScores = useCallback(() => {
    fetch("/api/scores")
      .then((r) => r.json())
      .then((rows) => {
        setScores(rows);
        setDbError(null);
      })
      .catch(() => setDbError("score API unreachable — is the db server runner started?"));
  }, []);

  useEffect(refreshScores, [refreshScores]);

  // Record each finished game once into the SQLite score API (best-effort).
  const gameOver = Boolean(winner) || isDraw;
  useEffect(() => {
    if (!gameOver || recordedRef.current) return;
    recordedRef.current = true;
    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner: winner || "draw" }),
    })
      .then(refreshScores)
      .catch(() => setDbError("score API unreachable — is the db server runner started?"));
  }, [gameOver, winner, refreshScores]);

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
        </div>
        <div className="game-info">
          <h3>Move History</h3>
          <ol>{moves}</ol>
          <h3 data-cmp="ttt.scores_title">Saved Results (SQLite)</h3>
          {dbError ? (
            <p className="db-error" data-cmp="ttt.scores_error">{dbError}</p>
          ) : scores.length === 0 ? (
            <p data-cmp="ttt.scores_empty">No games recorded yet.</p>
          ) : (
            <ol data-cmp="ttt.scores_list">
              {scores.map((s) => (
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
