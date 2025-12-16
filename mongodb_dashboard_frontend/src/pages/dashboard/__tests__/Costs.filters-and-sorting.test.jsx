import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Costs from '../Costs';

// Mock DataTable to render headers (with headerRender) and current rows
jest.mock('../../../components/DataTable.jsx', () => {
  return function MockTable({ columns = [], data = [], fetchPage }) {
    return (
      <div>
        <table data-testid="mock-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>
                  {c.headerRender ? c.headerRender() : c.label || c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => {
                  const val = row[c.key];
                  const node = c.render ? c.render(val, row) : (val ?? '—');
                  return <td key={c.key}>{node}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => fetchPage(1, 10)}>pageAction</button>
      </div>
    );
  };
});

// Mock underscore list API; returns 4 rows with varied fields
jest.mock('../../../api', () => ({
  listLlmCostsUnderscore: jest.fn(async () => ({
    items: [
      { organization_id: 'o1', organization_name: 'Acme Corp', organization_cost: 2.5, users: 3, user_id: 'u1', type: 'chat', user_cost: 1.2, projects: 2 },
      { organization_id: 'o2', organization_name: 'Beta LLC', organization_cost: 1.0, users: 2, user_id: 'u2', type: 'embed', user_cost: 0.5, projects: 1 },
      { organization_id: 'o3', organization_name: 'Acme Labs', organization_cost: 5.1, users: 1, user_id: 'z9', type: 'chat', user_cost: 4.7, projects: 4 },
      { organization_id: 'o4', organization_name: 'Delta Inc', organization_cost: 0.1, users: 5, user_id: 'a1', type: 'tts', user_cost: 0.05, projects: 3 },
    ],
    meta: { page: 1, limit: 10, total: 4 },
  })),
}));

describe('Costs page - client filters and sorting', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('filters by organization_name containing text', async () => {
    render(<Costs />);

    // Load dataset first
    const loadBtn = await screen.findByRole('button', { name: /load costs/i });
    fireEvent.click(loadBtn);

    // Filter by "Acme"
    const orgFilter = await screen.findByPlaceholderText(/contains/i);
    fireEvent.change(orgFilter, { target: { value: 'Acme' } });

    // Expect only Acme rows visible
    const table = await screen.findByTestId('mock-table');
    expect(table).toBeInTheDocument();
    // There should be two rows matching Acme
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(table.textContent).toMatch(/Acme Corp/);
    expect(table.textContent).toMatch(/Acme Labs/);
  });

  test('sorts by user_cost asc/desc when toggling header', async () => {
    render(<Costs />);

    const loadBtn = await screen.findByRole('button', { name: /load costs/i });
    fireEvent.click(loadBtn);

    // Find sort header button for "User Cost"
    const sortBtn = await screen.findByRole('button', { name: /sort by user cost/i });
    // First click -> asc
    fireEvent.click(sortBtn);

    let table = await screen.findByTestId('mock-table');
    // First row should be the smallest user_cost (0.05 from Delta Inc)
    let firstRowText = table.querySelector('tbody tr')?.textContent || '';
    expect(firstRowText).toMatch(/Delta Inc/);

    // Second click -> desc
    fireEvent.click(sortBtn);
    table = await screen.findByTestId('mock-table');
    firstRowText = table.querySelector('tbody tr')?.textContent || '';
    // Now first row should be highest user_cost (4.7 from Acme Labs)
    expect(firstRowText).toMatch(/Acme Labs/);
  });
});
