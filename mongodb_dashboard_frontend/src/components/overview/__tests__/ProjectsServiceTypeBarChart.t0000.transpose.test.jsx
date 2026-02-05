import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectsServiceTypeBarChart from '../ProjectsServiceTypeBarChart';

// Mock org id hook to force T0000 behavior
jest.mock('../../../hooks/useCurrentOrgId', () => ({
  __esModule: true,
  default: () => 'T0000',
}));

// Mock apiGet to return the *backend-shaped* response for T0000:
// labels = service types, series = tenants
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  apiGet: jest.fn(),
}));

describe('ProjectsServiceTypeBarChart - T0000 shaped response transpose', () => {
  it('transposes backend labels/series into tenants on Y-axis and service types as stacks', async () => {
    const { apiGet } = require('../../../utils/api');

    apiGet.mockResolvedValueOnce({
      labels: ['Chat', 'Search'], // service types
      series: [
        { name: 'tenantA', data: [3, 1] },
        { name: 'tenantB', data: [0, 2] },
      ],
      meta: { specialCase: 'T0000' },
    });

    render(<ProjectsServiceTypeBarChart />);

    // Title should show the all-tenants variant
    expect(
      await screen.findByText('Sessions by Service Type (Tenants on Y-axis)')
    ).toBeInTheDocument();

    // Wait for chart to reach success state (loading disappears)
    await waitFor(() => {
      expect(screen.queryByText(/Loading…/i)).not.toBeInTheDocument();
    });

    // Sanity: should not show empty/error state.
    expect(
      screen.queryByText(/No sessions found for the selected range/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Verify API called
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
