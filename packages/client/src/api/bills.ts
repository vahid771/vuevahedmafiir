// ─── Types ────────────────────────────────────────────────────────────────────

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
