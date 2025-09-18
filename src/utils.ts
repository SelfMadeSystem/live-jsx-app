import { useEffect, useRef, useState } from 'react';

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

export const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

export const debounce = <T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number,
) => {
  let timeoutId: number | NodeJS.Timeout;
  return (...args: T) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

/**
 * A valid filename must:
 * - Not contain any of the following characters: : * ? " < > |.
 *   - Note: we allow / and \ because we want some sort of file path support.
 * - Not be empty.
 * - Not be longer than 255 characters.
 * - Not contain any leading or trailing spaces.
 * - Not contain any consecutive spaces.
 * - Not be a reserved name (e.g. CON, PRN, AUX, NUL, COM1, LPT1, etc.).
 * - Not contain any control characters (ASCII 0-31).
 * - Not be a dot, two dots, or a space.
 */
export function isValidFilename(str: string) {
  const invalidChars = /[<>:"|?*]/;
  const reservedNames = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ];
  return (
    str.length > 0 &&
    str.length <= 255 &&
    !invalidChars.test(str) &&
    !reservedNames.includes(str.toUpperCase()) &&
    !/\s{2,}/.test(str) &&
    !/^\s|\s$/.test(str) &&
    !/[^\x20-\x7E]/.test(str)
  );
}
