import { useState } from "react";
import Board from "./components/Board";

/**
 * @typedef {Object} WinnerInfo
 * @property {string} winner
 * @property {number[]} line
 */

/**
 * @param {(string | null)[]} squares
 * @returns {WinnerInfo | null}
 */
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
        winner: /** @type {string} */ (squares[a]),
        line: lines[i],
      };
    }
  }
  return null;
};

const App = () => {
  const [history, setHistory] = useState([
    {
      squares: Array(9).fill(null),
    },
  ]);
  const [currentMove, setCurrentMove] = useState(0);
  const xIsNext = currentMove % 2 === 0;
  const currentSquares = history[currentMove].squares;

  /**
   * @param {number} i
   * @returns {void}
   */
  const handleClick = (i) => {
    // If square is already filled or game is won, ignore click
    if (currentSquares[i] || calculateWinner(currentSquares)) {
      return;
    }

    const nextSquares = currentSquares.slice();
    nextSquares[i] = xIsNext ? "X" : "O";

    // Create new history up to current move and add new move
    const nextHistory = [
      ...history.slice(0, currentMove + 1),
      { squares: nextSquares },
    ];
    setHistory(nextHistory);
    setCurrentMove(nextHistory.length - 1);
  };

  /**
   * @param {number} move
   * @returns {void}
   */
  const jumpTo = (move) => {
    setCurrentMove(move);
  };

  /**
   * @returns {void}
   */
  const restartGame = () => {
    setHistory([{ squares: Array(9).fill(null) }]);
    setCurrentMove(0);
  };

  // Determine game status
  const winnerInfo = calculateWinner(currentSquares);
  /**
   * @type {string | null}
   */
  const winner = winnerInfo?.winner || null;
  /**
   * @type {number[] | null}
   */
  const winningLine = winnerInfo?.line || null;
  const isDraw = !winner && currentSquares.every((square) => square !== null);

  let status;
  if (winner) {
    status = `Winner: ${winner}`;
  } else if (isDraw) {
    status = "It's a Draw!";
  } else {
    status = `Next player: ${xIsNext ? "X" : "O"}`;
  }

  // Generate move history list
  /**
   * @type {JSX.Element[]}
   */
  const moves = history.map((_step, move) => {
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

  const statusClassName = `status ${
    winner ? "winner" : isDraw ? "draw" : ""
  }`;

  return (
    <div className="game">
      <div className="game-header">
        <h1>Tic Tac Toe</h1>
      </div>
      <div className="game-container">
        <div className="game-board">
          <div className={statusClassName} role="status" aria-live="polite">
            {status}
          </div>
          <Board
            squares={currentSquares}
            onClick={handleClick}
            winningLine={winningLine}
          />
          <button
            className="restart-button"
            onClick={restartGame}
            aria-label="Restart the game">
            Restart Game
          </button>
        </div>
        <div className="game-info">
          <h3>Move History</h3>
          <ol>{moves}</ol>
        </div>
      </div>
    </div>
  );
};

export default App;
