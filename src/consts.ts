export const DEFAULT_TSX = /*js*/ `\
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState<number>(0);
  const overTen = count > 10;

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100">
      <p className="text-2xl font-bold mb-4">{count}</p>
      <button 
        className={\`fancy-btn px-4 py-2 text-white rounded \${overTen ? "uwuness" : ""}\`}
        onClick={() => setCount(count + 1)}
      >
        Increment
      </button>
    </div>
  );
}
`;

export const DEFAULT_CSS = /*css*/ `\
.fancy-btn {
  transition: all 0.2s;
  background: linear-gradient(90deg, #007cf0, #00dfd8);
  background-size: 200% auto;
}

.fancy-btn:hover {
  background-position: right center;
}

.fancy-btn:active {
  transform: scale(0.95);
}
`;
