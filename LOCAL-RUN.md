# Local run

From the project root, install dependencies and generate the GraphQL Mesh SDK:

```sh
npm install
npm run mesh:build
npm run dev
```

The Mesh build generates `.mesh/`. Rebuild it after changing `.meshrc.yml` or files in `mesh/`.

## Try the API

Open `http://localhost:4000/graphql` and enter `{"client":"test"}` in the GraphiQL Headers panel.

### Verify the local address query

```graphql
query {
  address(username: "jack") {
    city
    state
  }
}
```

An existing record with no saved state returns `state: null`. Query an unused username to verify the `No address found in getAddress resolver` error.

### Create and read back an address

With `{"client":"test"}` in the Headers panel, run this mutation with an unused username. It writes a new record to `data/addresses.json`.

```graphql
mutation {
  createAddress(
    username: "local-run-check"
    address: { street: "10 Main St", city: "Columbus", zipcode: "43215", state: "OH" }
  ) {
    street
    city
    zipcode
    state
  }
}
```

Query the same username to verify the saved values:

```graphql
query {
  address(username: "local-run-check") {
    street
    city
    zipcode
    state
  }
}
```

Repeat the mutation with the same username. Expect `An address already exists for this username`. The saved record should retain its original values. A mutation with a blank required address field should return `Street, city, and zipcode must not be blank`.

### Verify client restrictions

| Headers | Operation | Expected result |
| --- | --- | --- |
| `{}` | Address query | `The client header is required` |
| `{"client":"strata"}` | Address query | Returns the address |
| `{"client":"strata"}` | Create mutation with an unused username | `The strata client can only execute queries`, with no record added |
| `{"client":"test"}` | Create mutation with an unused username | Returns and saves the address |

### Verify request metadata and logs

Send an address query twice with `{"client":"test"}`. Each response should include `metadata.requestId`. In the server console, both resolver logs from the same query should show `client: test` and the same ID as the response. The second request should have a different ID. Query an unused username to verify that the resolver error and its console log also carry the matching ID.

### Verify the NASA feed query

Set the Headers panel back to `{"client":"test"}` before running the NASA query.

```graphql
query {
  nearEarthObjects(startDate: "2017-09-07", endDate: "2017-09-08") {
    elementCount
    objects {
      id
      name
      closeApproachDate
    }
  }
}
```

Mesh sends `DEMO_KEY` automatically. The NASA feed accepts an end date up to seven days after the start date. On success, the server logs `Loaded the NASA near-Earth object feed`. Its `requestId` should match `metadata.requestId` in the response.

Try `2017-02-30` as the start date to check calendar-date validation. With a start date of `2017-09-07` and an end date of `2017-09-15`, expect `endDate must be no more than 7 days after startDate`.

## Run the checks

```sh
npx tsc --noEmit
npx tsc --noEmit -p tests/tsconfig.json
npx jest --config ./jest.config.ts --runInBand
```
