// ─── Types ────────────────────────────────────────────────────────────────────

export interface Loan {
  id: number;
  user_id: number;
  name: string;
  lender: string | null;
  total_amount: number;
  remaining_amount: number;
  installment: number | null;
  due_day: number | null;
  next_payment_date: string | null;
  notes: string | null;
  active: number; // 0 | 1
  created_at: string;
}

export type CreateLoanData = {
  name: string;
  lender?: string;
  total_amount: number;
  remaining_amount: number;
  installment?: number;
  due_day?: number;
  next_payment_date?: string;
  notes?: string;
  active?: number;
};

export type UpdateLoanData = Partial<Omit<CreateLoanData, 'total_amount' | 'remaining_amount'>> & {
  total_amount?: number;
  remaining_amount?: number;
};

export interface Bill {
  id: number;
  user_id: number;
  name: string;
  amount: number | null;
  due_date: string | null;
  recurrence: 'once' | 'monthly' | 'yearly';
  paid: number; // 0 | 1
  created_at: string;
}

export interface Subscription {
  id: number;
  user_id: number;
  name: string;
  amount: number | null;
  billing_cycle: 'weekly' | 'monthly' | 'yearly' | null;
  next_billing_date: string | null;
  active: number; // 0 | 1
  max_repetitions: number | null;
  created_at: string;
}

export type CreateBillData = {
  name: string;
  amount?: number;
  due_date?: string;
  recurrence?: 'once' | 'monthly' | 'yearly';
  paid?: number;
};

export type UpdateBillData = Partial<CreateBillData>;

export type CreateSubscriptionData = {
  name: string;
  amount?: number;
  billing_cycle?: 'weekly' | 'monthly' | 'yearly';
  next_billing_date?: string;
  active?: number;
  max_repetitions?: number | null;
};

export type UpdateSubscriptionData = Partial<CreateSubscriptionData>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { apiUrl, authHeaders } from './base';

// ─── Bills ────────────────────────────────────────────────────────────────────

export async function getBills(token: string): Promise<Bill[]> {
  const res = await fetch(apiUrl('/api/bills'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch bills');
  return res.json() as Promise<Bill[]>;
}

export async function createBill(token: string, data: CreateBillData): Promise<Bill> {
  const res = await fetch(apiUrl('/api/bills'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create bill');
  return res.json() as Promise<Bill>;
}

export async function updateBill(token: string, id: number, data: UpdateBillData): Promise<Bill> {
  const res = await fetch(apiUrl(`/api/bills/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update bill');
  return res.json() as Promise<Bill>;
}

export async function deleteBill(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/bills/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete bill');
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscriptions(token: string): Promise<Subscription[]> {
  const res = await fetch(apiUrl('/api/subscriptions'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch subscriptions');
  return res.json() as Promise<Subscription[]>;
}

export async function createSubscription(
  token: string,
  data: CreateSubscriptionData
): Promise<Subscription> {
  const res = await fetch(apiUrl('/api/subscriptions'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create subscription');
  return res.json() as Promise<Subscription>;
}

export async function updateSubscription(
  token: string,
  id: number,
  data: UpdateSubscriptionData
): Promise<Subscription> {
  const res = await fetch(apiUrl(`/api/subscriptions/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update subscription');
  return res.json() as Promise<Subscription>;
}

export async function deleteSubscription(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/subscriptions/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete subscription');
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export async function getLoans(token: string): Promise<Loan[]> {
  const res = await fetch(apiUrl('/api/loans'), { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch loans');
  return res.json() as Promise<Loan[]>;
}

export async function createLoan(token: string, data: CreateLoanData): Promise<Loan> {
  const res = await fetch(apiUrl('/api/loans'), {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create loan');
  return res.json() as Promise<Loan>;
}

export async function updateLoan(token: string, id: number, data: UpdateLoanData): Promise<Loan> {
  const res = await fetch(apiUrl(`/api/loans/${id}`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update loan');
  return res.json() as Promise<Loan>;
}

export async function deleteLoan(token: string, id: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/loans/${id}`), {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete loan');
}
