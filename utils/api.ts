import { Cheque } from '../types';

export const fetchCheques = async (baseUrl: string, datasetId?: string): Promise<Cheque[]> => {
  // 1. If no datasetId is provided, return empty
  if (!datasetId) return [];

  // 2. Prepare URL (handle relative or absolute)
  const url = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const query = `?datasetId=${datasetId}`;

  try {
    const response = await fetch(`${url}/api/cheques${query}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    if (!response.ok) {
      // If 404, it might mean the dataset ID doesn't exist in Postgres yet
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Postgres Error ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
       throw new Error(`Expected JSON from server but got ${contentType}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error(`[API Fetch Failed] Could not retrieve data from Postgres: ${error.message}`);
    throw error; 
  }
};

export const syncCheques = async (baseUrl: string, data: Cheque[], datasetId: string): Promise<void> => {
  const url = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  
  try {
    const response = await fetch(`${url}/api/cheques/bulk`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ cheques: data, datasetId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Postgres Sync Failed (${response.status}): ${errorText || response.statusText}`);
    }
  } catch (error: any) {
    console.error(`[API Sync Failed] Could not save data to Postgres: ${error.message}`);
    throw error;
  }
};