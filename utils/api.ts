import { Cheque } from '../types';

// The base URL is empty because the frontend and backend are now served from the same origin (server.js)
// or proxied correctly.
const BASE_API_URL = '';

export const fetchCheques = async (baseUrl: string, datasetId?: string): Promise<Cheque[]> => {
  if (!datasetId) return [];
  
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques?datasetId=${datasetId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
       throw new Error(`Server Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("API Fetch Error:", error);
    throw new Error(`Could not fetch data: ${error.message}`);
  }
};

export const syncCheques = async (baseUrl: string, data: Cheque[], datasetId: string): Promise<void> => {
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cheques: data, datasetId }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server Sync Error: ${errText}`);
    }
    
    console.log(`Successfully synced ${data.length} records to Railway Postgres.`);
  } catch (error: any) {
    console.error("API Sync Error:", error);
    throw new Error(`Could not save to database: ${error.message}`);
  }
};