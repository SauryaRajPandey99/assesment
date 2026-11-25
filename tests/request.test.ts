import winston from 'winston';
import { yoga } from './exectuor';

const query = '{ address(username: "jack") { city } }';

const request = async (document: string, client?: string, operationName?: string) => {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (client !== undefined) {
    headers.set('client', client);
  }
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: document, operationName }),
  });
  return response.json();
};

test('requires the client header', async () => {
  const result = await request(query);

  expect(result.errors).toEqual([
    expect.objectContaining({ message: 'The client header is required' }),
  ]);
});

test('allows strata to select a query but rejects its mutation', async () => {
  const document = `
    query Lookup { address(username: "jack") { city } }
    mutation Create {
      createAddress(username: "jack", address: {
        street: "10 Main St", city: "Columbus", zipcode: "43215"
      }) { city }
    }
  `;

  expect((await request(document, 'strata', 'Lookup')).data).toEqual({
    address: { city: 'Sometown' },
  });
  expect((await request(document, 'strata', 'Create')).errors).toEqual([
    expect.objectContaining({ message: 'The strata client can only execute queries' }),
  ]);
});

test('uses the response request ID and client on every resolver log', async () => {
  const log = jest.spyOn(winston.transports.Console.prototype, 'log');
  try {
    const [success, failure] = await Promise.all([
      request(query, 'strata'),
      request('{ address(username: "john") { city } }', 'test'),
    ]);

    expect(success.metadata.requestId).toEqual(expect.any(String));
    expect(failure.metadata.requestId).toEqual(expect.any(String));
    expect(success.metadata.requestId).not.toBe(failure.metadata.requestId);
    expect(failure.errors).toEqual([
      expect.objectContaining({ message: 'No address found in getAddress resolver' }),
    ]);

    const records = log.mock.calls.map(([record]) => record);
    expect(records).toHaveLength(4);
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'info', client: 'strata', requestId: success.metadata.requestId }),
      expect.objectContaining({ level: 'error', client: 'test', requestId: failure.metadata.requestId }),
    ]));
    for (const client of ['strata', 'test']) {
      const clientRecords = records.filter((record) =>
        typeof record === 'object' && record !== null && 'client' in record && record.client === client
      );
      const requestId = client === 'strata' ? success.metadata.requestId : failure.metadata.requestId;
      expect(clientRecords).toEqual([
        expect.objectContaining({ requestId }),
        expect.objectContaining({ requestId }),
      ]);
    }
  } finally {
    log.mockRestore();
  }
});
