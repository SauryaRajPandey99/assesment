import { parse } from 'graphql';
import { fetchNasaFeed } from '../../src/schema/neo/nasa-sdk';
import { executor } from '../exectuor';

jest.mock('../../src/schema/neo/nasa-sdk');

const fetchFeed = jest.mocked(fetchNasaFeed);
const dates = { startDate: '2015-09-07', endDate: '2015-09-08' };
const document = parse(`
  query NearEarthObjects($startDate: String!, $endDate: String!) {
    nearEarthObjects(startDate: $startDate, endDate: $endDate) {
      elementCount
      objects {
        id
        name
        isPotentiallyHazardousAsteroid
        estimatedDiameterMinKm
        estimatedDiameterMaxKm
        closeApproachDate
        relativeVelocityKph
        missDistanceKm
      }
    }
  }
`);

beforeEach(() => {
  fetchFeed.mockReset();
});

test('passes the dates to the SDK and flattens the NASA feed', async () => {
  fetchFeed.mockResolvedValue({
    element_count: 2,
    near_earth_objects: {
      '2015-09-07': [{
        id: '1',
        name: 'First object',
        is_potentially_hazardous_asteroid: false,
        estimated_diameter: { kilometers: { estimated_diameter_min: 0.1, estimated_diameter_max: 0.2 } },
        close_approach_data: [
          { close_approach_date: '2014-01-01' },
          {
            close_approach_date: '2015-09-07',
            relative_velocity: { kilometers_per_hour: '12345.67' },
            miss_distance: { kilometers: '98765.43' },
          },
        ],
      }],
      '2015-09-08': [{ id: '2' }],
    },
  });

  const result = await executor({ document, variables: dates });

  expect(fetchFeed).toHaveBeenCalledWith(dates);
  expect(result).toMatchObject({
    data: {
      nearEarthObjects: {
        elementCount: 2,
        objects: [
          {
            id: '1',
            name: 'First object',
            isPotentiallyHazardousAsteroid: false,
            estimatedDiameterMinKm: 0.1,
            estimatedDiameterMaxKm: 0.2,
            closeApproachDate: '2015-09-07',
            relativeVelocityKph: '12345.67',
            missDistanceKm: '98765.43',
          },
          { id: '2', closeApproachDate: null, relativeVelocityKph: null },
        ],
      },
    },
  });
});

test.each([
  ['2015-02-30', 'startDate and endDate must be valid dates in YYYY-MM-DD format'],
  ['2015-09-09', 'startDate must be on or before endDate'],
  ['2015-08-31', 'endDate must be no more than 7 days after startDate'],
])('rejects invalid start date %s before calling the SDK', async (startDate, message) => {
  const result = await executor({ document, variables: { ...dates, startDate } });

  expect(result).toMatchObject({ errors: [{ message }] });
  expect(fetchFeed).not.toHaveBeenCalled();
});

test('returns a stable GraphQL error when the SDK fails', async () => {
  fetchFeed.mockRejectedValue(new Error('Upstream request timed out'));

  const result = await executor({ document, variables: dates });

  expect(result).toMatchObject({
    data: { nearEarthObjects: null },
    errors: [{ message: 'Unable to load near-Earth objects from NASA' }],
  });
});
