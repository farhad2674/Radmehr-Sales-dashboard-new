import { Cheque, RawChequeData } from '../types';

// Convert raw excel row to clean Cheque object
export const normalizeChequeData = (row: RawChequeData, index: number): Cheque | null => {
  if (!row['تاریخ سررسید'] || !row['مبلغ']) return null;

  // Clean amount (remove commas if string)
  let amount = 0;
  if (typeof row['مبلغ'] === 'number') {
    amount = row['مبلغ'];
  } else if (typeof row['مبلغ'] === 'string') {
    amount = parseFloat(row['مبلغ'].replace(/,/g, ''));
  }

  return {
    id: `row-${index}`,
    docNumber: String(row['شماره اسناد'] || ''),
    amount: amount,
    dueDate: String(row['تاریخ سررسید']).trim(),
    receivedFrom: String(row['دریافت از'] || 'نامشخص').trim(),
    status: row['آخرین وضعیت'] || '',
    bank: row['بانک'] || '',
  };
};

// Format currency in Tomans/Rials
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('fa-IR').format(val);
};

// Get current Jalali date string (Simplified for demo, usually requires a library like jalaali-js)
// Assuming input data is already correctly formatted YYYY/MM/DD
export const getCurrentJalaliDate = (): string => {
    // Ideally use moment-jalaali or similar. Here we default to a hardcoded logic or
    // for the sake of the demo, let's assume "Today" is roughly 1403/03/01 if not provided.
    // In a real app, use `new Date().toLocaleDateString('fa-IR')` and format.
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'persian' };
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}/${m}/${d}`;
};

export const parseExcelDate = (excelDate: any): string => {
    // If Excel date is a serial number, conversion logic would go here.
    // Based on screenshot, it looks like text "1403/02/03".
    return String(excelDate);
};

export const toPersianDigits = (value: string | number): string => {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(value).replace(/[0-9]/g, (w) => id[+w]);
};