import { apiFetch } from './apiClient.js';

export const getEntries = () => {
  return apiFetch('/entries');
};

export const deleteEntry = (id) => {
  return apiFetch(`/entries/${id}`, {
    method: 'DELETE'
  });
};

export const updateEntry = (id, data) => {
  return apiFetch(`/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};