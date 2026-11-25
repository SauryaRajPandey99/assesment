import winston from 'winston';

export class Logger {
  private winston: any;
  requestId: string = '';
  constructor() {
    this.winston = winston.createLogger({
      level: 'info',
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [new winston.transports.Console()],
    });
  }

  setRequestId(requestId: string) {
    this.requestId = requestId;
    // Set this once so every log from this request carries the same ID.
    this.winston.defaultMeta = { ...this.winston.defaultMeta, requestId };
  }

  setClient(client: string) {
    // Keep the request ID when adding the client to the log metadata.
    this.winston.defaultMeta = { ...this.winston.defaultMeta, client };
  }

  info(message: string, meta?: object) {
    this.winston.info(message, meta);
  }

  error(message: string, meta?: object) {
    this.winston.error(message, meta);
  }

  warn(message: string, meta?: object) {
    this.winston.warn(message, meta);
  }
}
