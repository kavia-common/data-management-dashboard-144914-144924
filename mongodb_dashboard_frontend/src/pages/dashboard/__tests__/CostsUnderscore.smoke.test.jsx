import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Costs from '../Costs.jsx';

// Mock API to avoid network
jest.mock('../../../api', () => ({
  listLlmCostsUnderscore: jest.fn(async ({ organization_id, page, limit }) => ({
    items: [
      {
        organization_id: organization_id || 'org_demo',
        organization_name: 'Demo Org',
        organization_cost: 12.3456,
        users: 3,
        user_id: 'user_1',
        type: 'chat',
        user_cost: 4.5678,
        projects: 2,
      },
    ],
    total: 1,
    meta: { page: page || 1, limit: limit || 10, total: 1 },
  })),
}));

describe('Costs underscore page - smoke', () => {
  test('renders Load button and, after click, shows expected columns', async () => {
    render(<Costs />);
    const loadBtn = await screen.findByRole('button', { name: /load/i });
    expect(loadBtn).toBeInTheDocument();

    // Set organization id and click load
    const input = screen.getByLabelText(/organization id/i);
    fireEvent.change(input, { target: { value: 'org_123' } });
    fireEvent.click(loadBtn);

    // Expect table headers to be present via DataTable rendering path
    const orgHeader = await screen.findByText(/organization name/i);
    expect(orgHeader).toBeInTheDocument();
  });
});
