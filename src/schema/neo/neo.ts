import { GraphQLError } from 'graphql';
import type { ContextType } from '../../types';
import { fetchNasaFeed } from './nasa-sdk';
import type { FeedDates, NasaFeed } from './nasa-sdk';

const MAX_FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapFeed(feed: NasaFeed | null | undefined) {
  const groups = feed?.near_earth_objects;
  if (typeof feed?.element_count !== 'number' || !Number.isInteger(feed.element_count) ||
      !groups || typeof groups !== 'object' || Array.isArray(groups)) {
    throw new Error('The NASA feed is missing its count or date groups');
  }

  const objects = Object.entries(groups).flatMap(([date, entries]) => {
    if (!Array.isArray(entries)) {
      throw new Error('A NASA feed date group is not an array');
    }

    return entries.map((object) => {
      const diameter = object.estimated_diameter?.kilometers;
      // Prefer the approach for the object's feed date when NASA returns several.
      const approaches = object.close_approach_data;
      const approach = approaches?.find((item) => item.close_approach_date === date) ?? approaches?.[0];
      return {
        id: object.id,
        name: object.name,
        isPotentiallyHazardousAsteroid: object.is_potentially_hazardous_asteroid,
        estimatedDiameterMinKm: diameter?.estimated_diameter_min,
        estimatedDiameterMaxKm: diameter?.estimated_diameter_max,
        closeApproachDate: approach?.close_approach_date,
        relativeVelocityKph: approach?.relative_velocity?.kilometers_per_hour,
        missDistanceKm: approach?.miss_distance?.kilometers,
      };
    });
  });

  return { elementCount: feed.element_count, objects };
}

export async function nearEarthObjects(_: unknown, dates: FeedDates, context: ContextType) {
  const { startDate, endDate } = dates;
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) {
    throw new GraphQLError('startDate and endDate must be valid dates in YYYY-MM-DD format');
  }
  if (startDate > endDate) {
    throw new GraphQLError('startDate must be on or before endDate');
  }
  // Compare UTC days so daylight saving time cannot affect NASA's feed window.
  if (Date.parse(endDate) - Date.parse(startDate) > MAX_FEED_WINDOW_MS) {
    throw new GraphQLError('endDate must be no more than 7 days after startDate');
  }

  try {
    const feed = mapFeed(await fetchNasaFeed(dates));
    context.logger.info('Loaded the NASA near-Earth object feed', {
      startDate,
      endDate,
      objectCount: feed.objects.length,
    });
    return feed;
  } catch {
    context.logger.error('Could not load the NASA near-Earth object feed', { startDate, endDate });
    throw new GraphQLError('Unable to load near-Earth objects from NASA');
  }
}
