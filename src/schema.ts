import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeResolvers } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";
import path from "path";

export const genSchema = async () => {
  const schemaDir = path.join(__dirname, "../src/schema");
  const options = { globOptions: { cwd: schemaDir, absolute: true } };
  const modulesTypedefs = loadFilesSync("**/*.graphql", options);
  const resolverFiles = loadFilesSync("**/resolvers.?s", options);
  const modulesResolvers = mergeResolvers(resolverFiles);

  const schema = makeExecutableSchema({
    typeDefs: [modulesTypedefs],
    resolvers: [modulesResolvers],
  });
  return schema;
};
