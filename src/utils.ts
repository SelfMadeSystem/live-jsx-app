import { useEffect, useRef } from 'react';

export const log = <T>(...value: [...unknown[], T]): T => {
  console.log(...value);
  return value[value.length - 1] as T;
};

export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};
