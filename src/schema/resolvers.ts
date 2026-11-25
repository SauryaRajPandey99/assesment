import { createAddress, getAddress } from "./address/address";
import { Address, Args, CreateAddressArgs } from "./address/types";
import { nearEarthObjects } from "./neo/neo";

export const resolvers = {
  Query: {
    nearEarthObjects,
    address: (parent: any, args: Args, context: any, info: any): Address => {
      return getAddress(parent, args, context);
    },
  },
  Mutation: {
    createAddress: (parent: unknown, args: CreateAddressArgs, context: any): Address => {
      return createAddress(parent, args, context);
    },
  },
};
