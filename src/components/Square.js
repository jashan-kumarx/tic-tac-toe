/**
 * @typedef {Object} SquareProps
 * @property {string | null} value
 * @property {React.MouseEventHandler<HTMLButtonElement>} onClick
 * @property {boolean} [isWinning]
 * @property {number} index
 */

/**
 * @param {SquareProps} props
 * @returns {JSX.Element}
 */
const Square = ({ value, onClick, isWinning, index }) => {
  /**
   * @param {number} idx
   * @returns {string}
   */
  const getPositionLabel = (idx) => {
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    return `Row ${row}, Column ${col}`;
  };

  const ariaLabel = value
    ? `${getPositionLabel(index)}: ${value}`
    : `Empty square, ${getPositionLabel(index)}`;

  return (
    <button
      className={`square ${isWinning ? "winning" : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={!!value}>
      {value}
    </button>
  );
};

export default Square;
