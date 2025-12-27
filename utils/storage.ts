import CryptoJS from 'crypto-js';
import { Cheque } from '../types';

const API_URL = 'https://jsonblob.com/api/jsonBlob';

interface SharePayload {
  content: string; // Encrypted string
  v: number;
  timestamp: number;
}

// Save and Encrypt
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
        
        const body = JSON.stringify(payload);

        // Check payload size (Safety check ~1MB)
        if (body.length > 1024 * 1024) {
            throw new Error('حجم داده‌ها بیش از حد مجاز برای اشتراک‌گذاری است (محدودیت ۱ مگابایت)');
        }
        
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            credentials: 'omit', // Prevent sending cookies/auth which might trigger CORS issues
            referrerPolicy: 'no-referrer', // Privacy and avoid referrer blocks
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: body
        });

        if (!response.ok) {
            throw new Error(`خطای سرور ذخیره‌سازی: ${response.status}`);
        }

        // Location header contains the URL: https://jsonblob.com/api/jsonBlob/<uuid>
        // Sometimes exposed as x-jsonblob in certain CORS configs or just Location
        const location = response.headers.get('Location') || response.headers.get('x-jsonblob');
        
        if (!location) throw new Error('شناسه اشتراک‌گذاری در پاسخ سرور یافت نشد');
        
        const id = location.split('/').pop();
        return id || '';
    } catch (error: any) {
        console.error("Storage Error:", error);
        // Normalize common fetch errors
        if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
            throw new Error('خطا در اتصال به سرور. لطفا اتصال اینترنت، VPN یا تنظیمات شبکه خود را بررسی کنید.');
        }
        throw error;
    }
};

// Load and Decrypt
export const loadSharedDashboard = async (id: string, passcode: string): Promise<Cheque[]> => {
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        });

        if (!response.ok) {
            if (response.status === 404) throw new Error('داشبوردی با این شناسه یافت نشد');
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
            throw new Error('خطا در اتصال به سرور. لطفا اتصال اینترنت خود را بررسی کنید.');
        }
        throw error;
    }
};