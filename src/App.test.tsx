import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the service worker
jest.mock('./serviceWorker', () => ({
  register: jest.fn(),
}));

test('renders login form when not authenticated', () => {
  render(<App />);
  const loginElement = screen.getByText(/Task Assigner/i);
  expect(loginElement).toBeInTheDocument();
});
