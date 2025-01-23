export const DEFAULT_TSX = /*js*/ `\
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState<number>(0);
  const geTen = count >= 10;

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100"
      style={{
        '--n': count - 9
      } as React.CSSProperties}>
      <p className="text-2xl font-bold mb-4">{count}</p>
      <div className={\`seperator-top \${geTen ? "ge-ten" : ""}\`}></div>
      <button
        className={\`fancy-btn px-4 py-2 text-white rounded \${geTen ? "ge-ten" : ""}\`}
        onClick={() => setCount(count + 1)}
      >
        Increment
      </button>
      <div className={\`seperator \${geTen ? "ge-ten" : ""}\`}></div>
      <button
        className={\`fancy-btn px-4 py-2 text-white rounded \${geTen ? "ge-ten" : ""}\`}
        onClick={() => setCount(count - 1)}
      >
        Decrement
      </button>
    </div>
  );
}
`;

export const DEFAULT_CSS = /*css*/ `\
.fancy-btn {
  transition: background-position 0.2s,
    --s1 0.3s,
    --s2 1s;
  background: linear-gradient(90deg, #007cf0, #00dfd8);
  background-size: 200% auto;
  transform: scale(calc(var(--s1) * var(--s2)));
}

.fancy-btn:hover {
  background-position: right center;
}

.fancy-btn:active {
  --s1: 0.93;
}

@property --s1 {
  syntax: '<number>';
  inherits: true;
  initial-value: 1;
}

@property --s2 {
  syntax: '<number>';
  inherits: true;
  initial-value: 1;
}

@property --n {
  syntax: '<number>';
  inherits: true;
  initial-value: 1;
}

.fancy-btn.ge-ten {
  --s2: calc(var(--n) * 0.1 + 1);
}

.seperator {
  transition: height 1s;
  height: 0px;
}

.seperator.ge-ten {
  height: calc(var(--n) * 4px);
}

.seperator-top {
  transition: height 1s;
  height: 0px;
}

.seperator-top.ge-ten {
  height: calc(var(--n) * 2px);
}
`;
