import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'graphql';
import { executor } from '../exectuor';

const addressesPath = resolve(__dirname, '../../data/addresses.json');
let directory: string;
let fixturePath: string;
let failAddressReplacement = false;

jest.mock('node:fs', () => {
  const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
  const pathUtils = jest.requireActual<typeof import('node:path')>('node:path');
  const storePath = pathUtils.resolve(__dirname, '../../data/addresses.json');
  // Redirect only address-store paths, including the temporary file used for writes.
  const fixture = (path: string) => {
    if (path === storePath || (typeof path === 'string' && path.startsWith(`${storePath}.`))) {
      return `${fixturePath}${path.slice(storePath.length)}`;
    }
    return path;
  };

  return {
    ...fs,
    readFileSync: (path: string, encoding: BufferEncoding) => fs.readFileSync(fixture(path), encoding),
    writeFileSync: (path: string, data: string, encoding: BufferEncoding) => fs.writeFileSync(fixture(path), data, encoding),
    renameSync: (from: string, to: string) => {
      if (to === storePath && failAddressReplacement) {
        throw new Error('Address file replacement failed');
      }
      fs.renameSync(fixture(from), fixture(to));
    },
    rmSync: (path: string, options: import('node:fs').RmOptions) => fs.rmSync(fixture(path), options),
  };
});

const address = { street: '10 Main St', city: 'Columbus', zipcode: '43215', state: 'OH' };
const mutation = parse(`
  mutation CreateAddress($username: String!, $address: AddressInput!) {
    createAddress(username: $username, address: $address) { street city zipcode state }
  }
`);

beforeEach(() => {
  failAddressReplacement = false;
  directory = mkdtempSync(join(tmpdir(), 'interview-addresses-'));
  fixturePath = join(directory, 'addresses.json');
  copyFileSync(addressesPath, fixturePath);
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

test('creates an address that can be queried and preserves existing records', async () => {
  const username = 'ticket7-created';
  const original = JSON.parse(readFileSync(fixturePath, 'utf8'));

  const created = await executor({ document: mutation, variables: { username, address } });
  expect(created).toMatchObject({ data: { createAddress: address } });

  const lookup = await executor({
    document: parse('query ($username: String!) { address(username: $username) { street city zipcode state } }'),
    variables: { username },
  });
  expect(lookup).toMatchObject({ data: { address } });
  expect(JSON.parse(readFileSync(fixturePath, 'utf8'))).toEqual({ ...original, [username]: address });
});

test('rejects a duplicate username without changing any records', async () => {
  const original = readFileSync(fixturePath, 'utf8');

  const result = await executor({ document: mutation, variables: { username: 'jack', address } });

  expect(result).toMatchObject({ errors: [{ message: 'An address already exists for this username' }] });
  expect(readFileSync(fixturePath, 'utf8')).toBe(original);
});

test('rejects a blank required address field without writing a record', async () => {
  const original = readFileSync(fixturePath, 'utf8');

  const result = await executor({
    document: mutation,
    variables: { username: 'ticket7-invalid', address: { ...address, city: ' ' } },
  });

  expect(result).toMatchObject({ errors: [{ message: 'Street, city, and zipcode must not be blank' }] });
  expect(readFileSync(fixturePath, 'utf8')).toBe(original);
});

test('preserves both records when creates overlap', async () => {
  const usernames = ['ticket7-first', 'ticket7-second'];
  const results = await Promise.all(usernames.map((username) => executor({
    document: mutation,
    variables: { username, address },
  })));

  for (const result of results) {
    expect(result).toMatchObject({ data: { createAddress: address } });
  }
  const saved = JSON.parse(readFileSync(fixturePath, 'utf8'));
  expect(saved).toMatchObject({ [usernames[0]]: address, [usernames[1]]: address });
});

test('keeps the store intact and removes the temporary file when replacement fails', async () => {
  const original = readFileSync(fixturePath, 'utf8');
  const variables = { username: 'ticket7-retry', address };

  failAddressReplacement = true;
  const failed = await executor({ document: mutation, variables });

  expect(failed).toMatchObject({ errors: [expect.objectContaining({ message: expect.any(String) })] });
  expect(readFileSync(fixturePath, 'utf8')).toBe(original);
  expect(readdirSync(directory)).toEqual(['addresses.json']);

  failAddressReplacement = false;
  const retried = await executor({ document: mutation, variables });
  expect(retried).toMatchObject({ data: { createAddress: address } });
});
