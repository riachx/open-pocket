// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api'; // Your backend URL

export const api = {
  // Example API calls
  getPoliticians: () => axios.get(`${API_BASE_URL}/politicians`),
  getPoliticianById: (id: string) => axios.get(`${API_BASE_URL}/politicians/${id}`),
  // Add more API calls as needed
};