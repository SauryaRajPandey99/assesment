import type { Plugin } from 'graphql-yoga';
import { Logger } from '../logger';
import { ContextType } from '../types';

export const useLogger = (): Plugin<ContextType> => {
  return {
    onParse({ context, extendContext }) {
      const logger = new Logger();
      logger.setRequestId(context.requestId);
      const client = context.request.headers.get('client');
      if (client) {
        logger.setClient(client);
      }
      extendContext({ logger: logger });
    },
  };
};
