import type { Plugin } from 'graphql-yoga';
import { getOperationAST, GraphQLError } from 'graphql';
import { v4 as uuid } from 'uuid';
import { ContextType } from '../types';

export const buildHeaders = (): Plugin<ContextType> => {
  return {
    onEnveloped({ extendContext }) {
      // Create the request ID before the logger reads it during parsing.
      extendContext({ requestId: uuid() });
    },
    onParams({ request }) {
      if (!request.headers.get('client')) {
        throw new GraphQLError('The client header is required');
      }
    },
    onExecute({ args }) {
      // Checking the operation because a document can have both queries and mutations.
      const operation = getOperationAST(args.document, args.operationName);
      //rejecting operation if client header is strata
      if (args.contextValue.request.headers.get('client') === 'strata' && operation?.operation === 'mutation') {
        throw new GraphQLError('The strata client can only execute queries');
      }

      return {
        onExecuteDone({ result, setResult }) {
          if (Symbol.asyncIterator in result) {
            return;
          }

          // Using the same request ID that the resolver logger uses.
          const response = {
            ...result,
            metadata: { requestId: args.contextValue.requestId },
          };
          setResult(response);
        },
      };
    },
  };
};
