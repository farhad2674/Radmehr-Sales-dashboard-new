import { Cheque } from '../types';

export const fetchCheques = async (baseUrl: string, datasetId?: string): Promise<Cheque[]> => {
  // Ensure no trailing slash
  const url = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  
  // Build query string
  const query = datasetId ? `?datasetId=${datasetId}` : '';

  try {
    const response = await fetch(`${url}/api/cheques${query}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    // Check if response is actually JSON (handles 404 HTML pages)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") === -1) {
       throw new Error(`Expected JSON but got ${contentType}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to fetch data from server');
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
      // Include datasetId in the payload
      body: JSON.stringify({ cheques: data, datasetId }),
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sync data to server');
  }
};