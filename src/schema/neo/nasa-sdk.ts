export type FeedDates = { startDate: string; endDate: string };

type NasaObject = {
  id?: string;
  name?: string;
  is_potentially_hazardous_asteroid?: boolean;
  estimated_diameter?: {
    kilometers?: { estimated_diameter_min?: number; estimated_diameter_max?: number };
  };
  close_approach_data?: {
    close_approach_date?: string;
    relative_velocity?: { kilometers_per_hour?: string };
    miss_distance?: { kilometers?: string };
  }[];
};

export type NasaFeed = {
  element_count?: number | null;
  near_earth_objects?: Record<string, NasaObject[]> | null;
};

type MeshSdk = {
  GetNasaNeoFeed(dates: FeedDates): Promise<{ nasaNeoFeed?: NasaFeed | null }>;
};

export async function fetchNasaFeed(dates: FeedDates) {
  // Loading the generated SDK only when the NASA query is requested.
  const { getMeshSDK } = require('../../../.mesh') as { getMeshSDK(): MeshSdk };
  const { nasaNeoFeed } = await getMeshSDK().GetNasaNeoFeed(dates);
  return nasaNeoFeed;
}
