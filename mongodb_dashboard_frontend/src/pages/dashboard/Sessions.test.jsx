import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sessions from './Sessions';
import { listSessions } from '../../api';

// Mock DataTable to make the test deterministic and not rely on async data fetching
jest.mock('../../components/DataTable.jsx', () => {
  return function MockTable({ data = [], onRowClick }) {
    return (
      <table data-testid="mock-table">
        <tbody>
          {(data || []).map((row, idx) => (
            <tr key={idx} data-testid={`row-${idx}`} onClick={() => onRowClick && onRowClick(row)}>
              <td>{row.task_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
});

// Mock listSessions to avoid network usage
jest.mock('../../api', () => ({
  listSessions: jest.fn(async () => ({
    items: [
      {
        _id: 'a1',
        task_id: 'T-1',
        tenant_id: 'org1',
        organization_name: 'Org One',
        service_type: 'etl',
        updatedAt: '2024-10-01T00:10:00.000Z',
      },
    ],
    meta: { page: 1, limit: 10, total: 1 },
  })),
}));

// Mock Modal child to assert it receives session prop
jest.mock('../../components/sessions/SessionDetailsModal', () => {
  return function MockModal({ open, session }) {
    return open ? <div data-testid="details-modal">Modal Open - {session?._id}</div> : null;
  };
});

describe('Sessions page', () => {
  test('clicking a row opens modal with the selected session', async () => {
    render(<Sessions />);
    // Wait for mock row to render
    const row = await screen.findByTestId('row-0');
    fireEvent.click(row);
    const modal = await screen.findByTestId('details-modal');
    expect(modal).toHaveTextContent('Modal Open - a1');
  });

  test('user-name filter triggers a single request with q=<username> (not duplicated)', async () => {
    render(<Sessions />);

    // initial mount triggers load + aggregates
    await waitFor(() => expect(listSessions).toHaveBeenCalled());

    listSessions.mockClear();

    const input = await screen.findByLabelText('Filter by User name');
    fireEvent.change(input, { target: { value: 'Aditi S' } });

    // Debounce is 250ms; allow effect to run
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));

    // One call is for table (limit 10), one call is for aggregates (limit 200). Both should have q == 'Aditi S'.
    const calls = listSessions.mock.calls.map((args) => args?.[0] || {});
    expect(calls.every((p) => typeof p.q === 'string')).toBe(true);
    expect(calls.every((p) => p.q === 'Aditi S')).toBe(true);
  });
});
