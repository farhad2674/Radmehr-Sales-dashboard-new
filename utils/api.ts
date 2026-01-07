import { Cheque } from '../types';

const BASE_API_URL = '';

interface ApiResponse<T> {
  data: T;
  source: 'server' | 'local';
}

export const fetchCheques = async (baseUrl: string, datasetId?: string): Promise<ApiResponse<Cheque[]>> => {
  if (!datasetId) return { data: [], source: 'local' };
  
  // 1. Try Server
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques?datasetId=${datasetId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      return { data, source: 'server' };
    }
  } catch (error) {
    console.warn("Server connection failed, checking local storage...", error);
  }

  // 2. Fallback to Local Storage
  try {
    const localData = localStorage.getItem(`cheque_data_${datasetId}`);
    if (localData) {
      return { data: JSON.parse(localData), source: 'local' };
    }
  } catch (e) {
    console.error("Local storage read error", e);
  }

  return { data: [], source: 'local' };
};

export const syncCheques = async (baseUrl: string, data: Cheque[], datasetId: string): Promise<{ success: boolean; source: 'server' | 'local' }> => {
  // 1. Always save to Local Storage first (as backup/cache)
  try {
    localStorage.setItem(`cheque_data_${datasetId}`, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }

  // 2. Try Server Sync
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cheques: data, datasetId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If server explicitly returns error, we might want to throw, 
      // but for "User Experience" in a demo/no-backend setup, we treat Local as success.
      console.warn("Server rejected data:", errorText);
      // We return local success but log the server issue
      return { success: true, source: 'local' };
    }
    
    return { success: true, source: 'server' };

  } catch (error: any) {
    console.warn("Server unreachable during sync. Using Local Storage only.", error);
    return { success: true, source: 'local' };
  }
};