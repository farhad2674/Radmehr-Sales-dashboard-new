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
    series: String(row['سری'] || ''),
    amount: amount,
    dueDate: String(row['تاریخ سررسید']).trim(),
    operationDate: String(row['تاریخ عملیات'] || ''),
    receivedFrom: String(row['دریافت از'] || 'نامشخص').trim(),
    paidTo: String(row['پرداخت به'] || ''),
    status: row['آخرین وضعیت'] || '',
    bank: row['بانک'] || '',
    description: String(row['توضیحات'] || ''),
  };
};

// Format currency in Tomans/Rials
export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('fa-IR').format(val);
};

// Get current Jalali date string (Simplified for demo)
export const getCurrentJalaliDate = (): string => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'persian' };
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    return `${y}/${m}/${d}`;
};

export const parseExcelDate = (excelDate: any): string => {
    return String(excelDate);
};

export const toPersianDigits = (value: string | number): string => {
    const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(value).replace(/[0-9]/g, (w) => id[+w]);
};