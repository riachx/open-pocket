import { populateDatabase } from '../db/setup.js';
import dotenv from 'dotenv';

dotenv.config();

const STATE_REGIONS = [
  ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE'],
  ['MD', 'VA', 'NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'TN', 'KY'],
  ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD'],
  ['NE', 'KS', 'OK', 'TX', 'NM', 'AZ', 'CO', 'WY', 'MT', 'ID'],
  ['WA', 'OR', 'CA', 'NV', 'UT', 'HI', 'AK', 'WV', 'AR', 'LA'],
];

const GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  throw new Error('Missing Google API key (VITE_GOOGLE_API_KEY)');
}

const retry = async (fn: () => Promise<any>, retries = 3, delay = 500): Promise<any> => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    await new Promise((res) => setTimeout(res, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};

const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(id);
  return res;
};

const fetchStateData = async (state: string) => {
  const url = `https://civicinfo.googleapis.com/civicinfo/v2/representatives?address=${state},USA&roles=legislatorUpperBody&key=${GOOGLE_API_KEY}`;

  try {
    const response = await retry(() => fetchWithTimeout(url));
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    if (!data.offices || !data.officials) return [];

    const senateOffices = data.offices.filter((office: any) =>
      office.name.includes('U.S. Senator') || office.name.includes('United States Senate')
    );

    return senateOffices.flatMap((office: any) =>
      (office.officialIndices || []).map((index: number) => {
        const official = data.officials[index];
        return {
          name: official.name,
          party: official.party || 'Unknown',
          state: state,
          photoUrl: official.photoUrl?.replace(/=s\d+/, '=s200'),
          phones: official.phones || [],
        };
      })
    );
  } catch (err) {
    console.error(`Failed to fetch state ${state}:`, err);
    return [];
  }
};

const fetchAllSenators = async () => {
  const allSenators = [];
  for (const region of STATE_REGIONS) {
    console.log(`Fetching data for region: ${region.join(', ')}`);
    const regionResults = await Promise.all(region.map(fetchStateData));
    allSenators.push(...regionResults.flat());
  }
  return Array.from(
    new Map(allSenators.map((senator) => [`${senator.name}-${senator.state}`, senator])).values()
  );
};

const main = async () => {
  try {
    console.log('Fetching senator data...');
    const senators = await fetchAllSenators();
    console.log(`Found ${senators.length} senators`);
    
    console.log('Populating database...');
    await populateDatabase(senators);
    console.log('Database populated successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main(); 