export interface ImportantDate {
  id: number;
  user_id: number;
  title: string;
  date: string;
  recurs_yearly: number;
  notes: string | null;
  created_at: string;
  next_occurrence: string;
}

import { createResource } from './base';

const _dates = createResource<ImportantDate>('/api/dates');

export const getDates    = (token: string)                                             => _dates.getAll(token);
export const createDate  = (token: string, data: Partial<ImportantDate>)               => _dates.create(token, data);
export const updateDate  = (token: string, id: number, data: Partial<ImportantDate>)   => _dates.update(token, id, data);
export const deleteDate  = (token: string, id: number)                                 => _dates.remove(token, id);
