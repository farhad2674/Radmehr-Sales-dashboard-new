import { Cheque } from '../types';

const BASE_API_URL = '';

interface ApiResponse<T> {
  data: T;
}

export const fetchCheques = async (baseUrl: string, datasetId?: string): Promise<ApiResponse<Cheque[]>> => {
  if (!datasetId) return { data: [] };
  
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques?datasetId=${datasetId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      return { data };
    } else {
      throw new Error(`Server Error: ${response.statusText}`);
    }
  } catch (error: any) {
    console.error("Server connection failed:", error);
    throw new Error("ارتباط با سرور برقرار نشد (عدم استفاده از حالت آفلاین)");
  }
};

export const syncCheques = async (baseUrl: string, data: Cheque[], datasetId: string, filename: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetch(`${BASE_API_URL}/api/cheques/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        cheques: data, 
        datasetId: datasetId,
        filename: filename 
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server rejected data:", errorText);
      throw new Error(`خطای سرور: ${errorText}`);
    }
    
    return { success: true };

  } catch (error: any) {
    console.error("Sync failed:", error);
    throw new Error("خطا در ارسال به سرور. لطفاً اتصال اینترنت یا سرور را بررسی کنید.");
  }
};