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

import { createResource } from './base';

// ─── Bills ────────────────────────────────────────────────────────────────────

const _bills = createResource<Bill, CreateBillData>('/api/bills');

export const getBills    = (token: string)                                          => _bills.getAll(token);
export const createBill  = (token: string, data: CreateBillData)                    => _bills.create(token, data);
export const updateBill  = (token: string, id: number, data: UpdateBillData)        => _bills.update(token, id, data);
export const deleteBill  = (token: string, id: number)                              => _bills.remove(token, id);

// ─── Subscriptions ────────────────────────────────────────────────────────────

const _subs = createResource<Subscription, CreateSubscriptionData>('/api/subscriptions');

export const getSubscriptions    = (token: string)                                                  => _subs.getAll(token);
export const createSubscription  = (token: string, data: CreateSubscriptionData)                    => _subs.create(token, data);
export const updateSubscription  = (token: string, id: number, data: UpdateSubscriptionData)        => _subs.update(token, id, data);
export const deleteSubscription  = (token: string, id: number)                                      => _subs.remove(token, id);

// ─── Loans ────────────────────────────────────────────────────────────────────

const _loans = createResource<Loan, CreateLoanData>('/api/loans');

export const getLoans    = (token: string)                                          => _loans.getAll(token);
export const createLoan  = (token: string, data: CreateLoanData)                    => _loans.create(token, data);
export const updateLoan  = (token: string, id: number, data: UpdateLoanData)        => _loans.update(token, id, data);
export const deleteLoan  = (token: string, id: number)                              => _loans.remove(token, id);
