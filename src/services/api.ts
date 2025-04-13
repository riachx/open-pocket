// src/services/api.ts
import axios from 'axios';

const BASE_URL = '/api';

export interface Senator {
  id: number;
  name: string;
  party: string;
  state: string;
  photoUrl?: string;
  phones?: string[];
}

export interface Contribution {
  contributor_name: string;
  amount: number;
  year: number;
}

export interface ContributionSummary {
  year: number;
  total_amount: number;
  contributor_count: number;
}

export const api = {
  getAllSenators: async (): Promise<Senator[]> => {
    const response = await axios.get(`${BASE_URL}/senators`);
    return response.data;
  },

  getSenatorsByState: async (state: string): Promise<Senator[]> => {
    const response = await axios.get(`${BASE_URL}/senators/state/${state}`);
    return response.data;
  },

  getSenatorsByParty: async (party: string): Promise<Senator[]> => {
    const response = await axios.get(`${BASE_URL}/senators/party/${party}`);
    return response.data;
  },

  getSenatorContributions: async (senatorName: string): Promise<Contribution[]> => {
    const response = await axios.get(`${BASE_URL}/senators/contributions/${encodeURIComponent(senatorName)}`);
    return response.data;
  },

  getSenatorContributionsByYear: async (senatorName: string, year: number): Promise<Contribution[]> => {
    const response = await axios.get(`${BASE_URL}/senators/contributions/${encodeURIComponent(senatorName)}/${year}`);
    return response.data;
  },

  // Example API calls
  getPoliticians: () => axios.get(`${BASE_URL}/politicians`),
  getPoliticianById: (id: string) => axios.get(`${BASE_URL}/politicians/${id}`),
  // Add more API calls as needed
};