import { useEffect, useRef } from 'react';

export const log = <T>(...value: [...unknown[], T]): T => {
  console.log(...value);
  return value[value.length - 1] as T;
};

export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
) => {
  let timeoutId: number;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

export function isValidIdentifier(str: string) {
  return /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(str);
}
