import React from "react";

const Square = ({ value, onClick, isWinning, index }) => {
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
