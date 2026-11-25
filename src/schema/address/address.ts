import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GraphQLError } from 'graphql';
import { v4 as uuid } from 'uuid';
import { Addresses, Address, Args, CreateAddressArgs } from './types';

const addressesPath = resolve(__dirname, '../../../data/addresses.json');

const readAddresses = (): Addresses => {
  return JSON.parse(readFileSync(addressesPath, 'utf8')) as Addresses;
};

const hasAddress = (addresses: Addresses, username: string): boolean =>
  Object.prototype.hasOwnProperty.call(addresses, username);

export const getAddress = (_: any, args: Args, context: any): Address => {
  context.logger.info('getAddress', 'Enter resolver');
  const addresses = readAddresses();
  if (hasAddress(addresses, args.username)) {
    context.logger.info('getAddress', 'Returning address');
    return addresses[args.username];
  }
  context.logger.error('getAddress', 'No address found');
  throw new GraphQLError('No address found in getAddress resolver');
};

export const createAddress = (_: unknown, { username, address }: CreateAddressArgs, context: any): Address => {
  context.logger.info('createAddress', 'Enter resolver');
  if (!username.trim()) {
    throw new GraphQLError('Username must not be blank');
  }
  if ([address.street, address.city, address.zipcode].some((value) => !value.trim())) {
    throw new GraphQLError('Street, city, and zipcode must not be blank');
  }

  // Read, duplicate check, and replacement synchronous so as to prevent
  // overlapping mutations in this server from losing records.
  const addresses = readAddresses();
  if (hasAddress(addresses, username)) {
    throw new GraphQLError('An address already exists for this username');
  }

  const updatedAddresses = { ...addresses, [username]: address };
  const temporaryPath = `${addressesPath}.${uuid()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(updatedAddresses, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, addressesPath);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch (cleanupError) {
      context.logger.warn('Could not remove temporary address file', { error: cleanupError });
    }
    throw error;
  }

  context.logger.info('createAddress', 'Saved address');
  return address;
};
