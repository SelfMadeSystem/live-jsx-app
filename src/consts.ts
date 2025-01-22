export const DEFAULT_TSX = `\
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100">
      <p className="text-2xl font-bold mb-4">{count}</p>
      <button 
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
        onClick={() => setCount(count + 1)}
      >
        Increment
      </button>
    </div>
  );
}
`;
