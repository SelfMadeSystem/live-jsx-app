export const log = <T>(...value: [...unknown[], T]): T => {
  console.log(...value);
  return value[value.length - 1] as T;
}