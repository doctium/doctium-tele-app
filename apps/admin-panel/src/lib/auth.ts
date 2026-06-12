'use client';

export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

export const setToken = (token: string) =>
  localStorage.setItem('adminToken', token);

export const clearToken = () =>
  localStorage.removeItem('adminToken');

export const isAuthenticated = () => !!getToken();
