# Tic Tac Toe Game

A complete, interactive Tic Tac Toe game built with React using functional components and hooks.

## Features

✅ **3x3 Game Board** - Classic tic-tac-toe grid  
✅ **Two Player Mode** - X and O alternating turns  
✅ **Turn Indicator** - Shows whose turn it is  
✅ **Winner Detection** - Automatically detects when a player wins  
✅ **Draw Detection** - Identifies when the game ends in a draw  
✅ **Winning Highlight** - Highlights the winning combination  
✅ **Restart Button** - Reset the board at any time  
✅ **Move Validation** - Prevents moves on filled squares  
✅ **Move History** - Track all moves made during the game  
✅ **Time Travel** - Jump back to any previous move  
✅ **Clean UI** - Simple and responsive design with CSS styling

## Project Structure

```
tic-tac-toe/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── components/
│   │   ├── Board.js        # Game board component
│   │   └── Square.js       # Individual square component
│   ├── App.js              # Main app with game logic
│   ├── App.css             # Styling
│   └── index.js            # Entry point
├── .eslintrc.json          # ESLint configuration
├── .eslintignore           # ESLint ignore patterns
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## Installation & Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the development server:**

   ```bash
   npm start
   ```

3. **Open your browser:**
   The game will automatically open at [http://localhost:3000](http://localhost:3000)

## How to Play

1. The game starts with player **X**
2. Click on any empty square to make a move
3. Players alternate turns between **X** and **O**
4. The first player to get 3 in a row (horizontal, vertical, or diagonal) wins
5. If all squares are filled with no winner, the game is a draw
6. Click **Restart Game** to start a new game
7. Use the **Move History** to jump back to any previous state

## Technologies Used

- **React** 18.2.0 - JavaScript library for building user interfaces
- **React Hooks** - useState for state management
- **CSS3** - Modern styling with animations and responsive design
- **Create React App** - Build tooling and development server

## Component Overview

### App Component

- Main component managing game state
- Implements game logic (winner detection, move validation)
- Manages move history and time travel
- Renders the board and game info

### Board Component

- Renders the 3x3 game grid
- Passes click handlers to squares
- Highlights winning squares

### Square Component

- Renders individual square button
- Displays X, O, or empty state
- Handles click events
- Shows winning state with special styling

## Available Scripts

- `npm start` - Run the app in development mode
- `npm build` - Build the app for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App (one-way operation)
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Automatically fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run verify` - Run full verification (type-check + lint + build)

## Verification Tools

This project includes the following verification tools:

- **TypeScript** - Type checking and IntelliSense support
  - Configuration: `tsconfig.json`
  - Type definitions: `@types/react`, `@types/react-dom`, `@types/node`
  - Supports both JavaScript and TypeScript files
  - Ready for gradual migration to TypeScript
- **ESLint** - JavaScript linting with React-specific rules
  - Configuration: `.eslintrc.json`
  - Ignore patterns: `.eslintignore`
  - Plugins: `eslint-plugin-react`, `eslint-plugin-react-hooks`
- **Build Verification** - Production build testing via `npm run verify`

Run `npm run verify` before committing to ensure code quality and buildability.

## License

This project is open source and available for educational purposes.

## Author

Built with ❤️ using React
