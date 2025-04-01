const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

/**
 * Get the filename from the file path. Strips ?query params and hashes.
 */
function getFilename(filePath: string) {
  const fileName = filePath.split('/').pop() || 'unknown';
  const [name] = fileName.split(/[?#]/);
  return name;
}

export function createLogger(filePath: string) {
  const fileName = getFilename(filePath);

  const filenameStyle = 'color: #0af; font-weight: normal;';
  const logStyle = 'color: #444; font-weight: bold;';
  const infoStyle = 'color: #0af; font-weight: bold;';
  const warnStyle = 'color: #fa0; font-weight: bold;';
  const errorStyle = 'color: #f00; font-weight: bold;';
  const debugStyle = 'color: #0af; font-weight: bold;';

  return {
    log: (...message: unknown[]) => {
      originalConsole.log(`%c[${fileName}]%c LOG:`, filenameStyle, logStyle, ...message);
    },
    info: (...message: unknown[]) => {
      originalConsole.info(`%c[${fileName}]%c INFO:`, filenameStyle, infoStyle, ...message);
    },
    warn: (...message: unknown[]) => {
      originalConsole.warn(`%c[${fileName}]%c WARN:`, filenameStyle, warnStyle, ...message);
    },
    error: (...message: unknown[]) => {
      originalConsole.error(`%c[${fileName}]%c ERROR:`, filenameStyle, errorStyle, ...message);
    },
    debug: (...message: unknown[]) => {
      originalConsole.debug(`%c[${fileName}]%c DEBUG:`, filenameStyle, debugStyle, ...message);
    },
  };
}