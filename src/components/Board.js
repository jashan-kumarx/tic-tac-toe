import Square from "./Square";

/**
 * @typedef {Object} BoardProps
 * @property {(string | null)[]} squares
 * @property {(index: number) => void} onClick
 * @property {number[] | null | undefined} [winningLine]
 */

/**
 * @param {BoardProps} props
 * @returns {JSX.Element}
 */
const Board = ({ squares, onClick, winningLine }) => {
  /**
   * @param {number} i
   * @returns {JSX.Element}
   */
  const renderSquare = (i) => {
    /**
     * @type {boolean | undefined}
     */
    const isWinning = winningLine ? winningLine.includes(i) : undefined;
    /**
     * @type {React.MouseEventHandler<HTMLButtonElement>}
     */
    const handleSquareClick = () => onClick(i);
    return (
      <Square
        key={i}
        value={squares[i]}
        onClick={handleSquareClick}
        isWinning={isWinning}
        index={i}
      />
    );
  };

  return (
    <div className="board">
      <div className="board-row">
        {renderSquare(0)}
        {renderSquare(1)}
        {renderSquare(2)}
      </div>
      <div className="board-row">
        {renderSquare(3)}
        {renderSquare(4)}
        {renderSquare(5)}
      </div>
      <div className="board-row">
        {renderSquare(6)}
        {renderSquare(7)}
        {renderSquare(8)}
      </div>
    </div>
  );
};

export default Board;
