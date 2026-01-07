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
    throw new Error("ارتباط با سرور برقرار نشد. لطفاً وضعیت سرور را بررسی کنید.");
  }
};

export const syncCheques = async (
  baseUrl: string, 
  data: Cheque[], 
  datasetId: string, 
  filename: string,
  onProgress?: (percentage: number) => void
): Promise<{ success: boolean }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Use relative path to ensure it hits the same origin
    xhr.open('POST', `/api/cheques/bulk`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
      } else if (xhr.status === 405) {
        // Specific error for the static server issue
        reject(new Error("خطای 405: متد مجاز نیست. لطفاً دستور استارت سرور را در Railway به 'node server.js' تغییر دهید."));
      } else if (xhr.status === 413) {
        reject(new Error("خطای 413: حجم فایل بسیار زیاد است."));
      } else {
        reject(new Error(`خطای سرور (${xhr.status}): ${xhr.responseText || 'مشکل ناشناخته'}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("خطا در شبکه. لطفاً اتصال اینترنت خود را بررسی کنید."));
    };

    xhr.send(JSON.stringify({ 
      cheques: data, 
      datasetId: datasetId, 
      filename: filename 
    }));
  });
};