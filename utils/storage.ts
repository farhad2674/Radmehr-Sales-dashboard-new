import CryptoJS from 'crypto-js';
import { Cheque } from '../types';

// Using ExtendsClass JSON Storage as a simulation of a database that allows custom keys.
// In a production environment, this should be replaced with your own backend API.
const API_BASE_URL = 'https://extendsclass.com/api/json-storage/bin';

interface SharePayload {
  content: string; // Encrypted string
  v: number;
  timestamp: number;
}

// Generate a random 5-digit ID (10000 - 99999)
const generateFiveDigitId = (): string => {
    return Math.floor(10000 + Math.random() * 90000).toString();
};

// Save and Encrypt with Unique 5-digit ID
export const saveSharedDashboard = async (data: Cheque[], passcode: string): Promise<string> => {
    try {
        const jsonString = JSON.stringify(data);
        // Encrypt using AES
        const encrypted = CryptoJS.AES.encrypt(jsonString, passcode).toString();
        
        const payload: SharePayload = { 
            content: encrypted, 
            v: 1,
            timestamp: Date.now()
        };
        
        // Safety check for size (~2MB limit for most free JSON bins)
        if (JSON.stringify(payload).length > 2 * 1024 * 1024) {
             throw new Error('حجم داده‌ها بیش از حد مجاز است');
        }

        let attempts = 0;
        const maxAttempts = 5;

        // Try to find a free 5-digit ID
        while (attempts < maxAttempts) {
            const id = generateFiveDigitId();
            
            try {
                // 1. Check if ID exists
                const checkRes = await fetch(`${API_BASE_URL}/${id}`, { 
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });

                if (checkRes.status === 404) {
                    // 2. ID is available, try to reserve/save
                    const saveRes = await fetch(`${API_BASE_URL}/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (saveRes.ok) {
                        return id;
                    }
                }
            } catch (innerErr) {
                // Ignore individual attempt errors and retry
                console.warn(`Attempt for ID ${id} failed`, innerErr);
            }
            
            attempts++;
        }
        
        throw new Error('سیستم قادر به ایجاد شناسه یکتا نبود. لطفا مجددا تلاش کنید.');

    } catch (error: any) {
        console.error("Storage Error:", error);
        if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
            throw new Error('خطا در اتصال به پایگاه داده. لطفا اینترنت خود را بررسی کنید.');
        }
        throw error;
    }
};

// Load and Decrypt
export const loadSharedDashboard = async (id: string, passcode: string): Promise<Cheque[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/${id}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error('داشبوردی با این شناسه ۵ رقمی یافت نشد');
            throw new Error(`خطای دریافت اطلاعات: ${response.status}`);
        }
        
        const payload = await response.json();
        
        if (!payload.content) throw new Error('فرمت داده‌های دریافتی معتبر نیست');

        // Decrypt using AES
        const bytes = CryptoJS.AES.decrypt(payload.content, passcode);
        let originalText = '';
        
        try {
            originalText = bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            throw new Error('رمز عبور اشتباه است');
        }

        if (!originalText) throw new Error('رمز عبور اشتباه است یا فایل خراب شده است');
        
        return JSON.parse(originalText);
    } catch (error: any) {
        console.error("Load Error:", error);
        if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
            throw new Error('خطا در اتصال به پایگاه داده. لطفا اینترنت خود را بررسی کنید.');
        }
        throw error;
    }
};