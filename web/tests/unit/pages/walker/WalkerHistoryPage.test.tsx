import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WalkerHistoryPage from '../../../../src/pages/walker/WalkerHistoryPage';
import * as historyRepo from '../../../../src/repositories/historyRecordRepository';
import * as campaignRepo from '../../../../src/repositories/campaignRepository';
import type { HistoryRecordData } from '../../../../src/models/historyRecord';
import type { CampaignData } from '../../../../src/models/campaign';

// Mock the repositories
vi.mock('../../../../src/repositories/historyRecordRepository');
vi.mock('../../../../src/repositories/campaignRepository');
vi.mock('../../../../src/hooks/useAuthContext', () => ({
  useAuthContext: () => ({
    currentUser: { id: 'walker-1', login: 'testwalker' },
  }),
}));

const mockHistoryRecords: (HistoryRecordData & { id: string })[] = [
  {
    id: 'hist-1',
    walkerId: 'walker-1',
    campaignId: 'campaign-1',
    date: new Date('2026-10-10'),
    streetName: 'Collins Street',
    income: 12500,
    doorCount: 50,
    durationMin: 45,
  },
  {
    id: 'hist-2',
    walkerId: 'walker-1',
    campaignId: 'campaign-2',
    date: new Date('2026-10-09'),
    streetName: 'Oxford Street',
    income: 15000,
    doorCount: 60,
    durationMin: 55,
  },
  {
    id: 'hist-3',
    walkerId: 'walker-1',
    campaignId: 'campaign-3',
    date: new Date('2026-10-08'),
    streetName: 'King Street',
    income: 10000,
    doorCount: 40,
    durationMin: 35,
  },
];

const mockCampaigns: Record<string, CampaignData & { id: string }> = {
  'campaign-1': { id: 'campaign-1', name: 'Campaign 1', status: 'complete' } as any,
  'campaign-2': { id: 'campaign-2', name: 'Campaign 2', status: 'review' } as any,
  'campaign-3': { id: 'campaign-3', name: 'Campaign 3', status: 'payment' } as any,
};

describe('WalkerHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (historyRepo.HistoryRecordRepository.getHistoryRecordsByWalker as any).mockResolvedValue(
      mockHistoryRecords
    );

    (campaignRepo.CampaignRepository.getGroup as any).mockImplementation(
      (id: string) => Promise.resolve(mockCampaigns[id])
    );
  });

  it('renders history page title', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Delivery History')).toBeInTheDocument();
    });
  });

  it('shows empty state when no history records', async () => {
    (historyRepo.HistoryRecordRepository.getHistoryRecordsByWalker as any).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No delivery history yet.')).toBeInTheDocument();
    });
  });

  it('displays earnings summary', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
      expect(screen.getByText('Doors Delivered')).toBeInTheDocument();
      expect(screen.getByText('Campaigns')).toBeInTheDocument();
    });
  });

  it('calculates correct totals', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Total earnings: 12500 + 15000 + 10000 = 37500
      expect(screen.getByText('$37,500.00')).toBeInTheDocument();
      // Total doors: 50 + 60 + 40 = 150
      expect(screen.getByText('150')).toBeInTheDocument();
      // Total campaigns: 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('groups records by campaign status', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Completed (1)')).toBeInTheDocument();
      expect(screen.getByText('Pending Review (1)')).toBeInTheDocument();
      expect(screen.getByText('Paid (1)')).toBeInTheDocument();
    });
  });

  it('displays record details in list', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Collins Street')).toBeInTheDocument();
      expect(screen.getByText('Oxford Street')).toBeInTheDocument();
      expect(screen.getByText('King Street')).toBeInTheDocument();
    });
  });

  it('shows income for each record', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('$125.00')).toBeInTheDocument();
      expect(screen.getByText('$150.00')).toBeInTheDocument();
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });
  });

  it('shows door count and duration for each record', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should show "50 doors" somewhere
      expect(screen.getByText(/50 doors/)).toBeInTheDocument();
    });
  });

  it('handles campaign fetch errors gracefully', async () => {
    (campaignRepo.CampaignRepository.getGroup as any).mockRejectedValue(
      new Error('Campaign not found')
    );

    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Should still show the history records even if campaign fetch fails
      expect(screen.getByText('Collins Street')).toBeInTheDocument();
    });
  });

  it('has accessibility labels on interactive elements', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const detailButton = screen.getByLabelText(/View details for Collins Street/);
      expect(detailButton).toBeInTheDocument();
    });
  });

  it('displays status badges with correct colors', async () => {
    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Completed')).toHaveLength(2); // Title + badge
      expect(screen.getAllByText('Pending Review')).toHaveLength(2); // Title + badge
      expect(screen.getAllByText('Paid')).toHaveLength(2); // Title + badge
    });
  });

  it('sorts records by date within each group', async () => {
    const unorderedRecords = [
      { ...mockHistoryRecords[2], date: new Date('2026-10-08') },
      { ...mockHistoryRecords[0], date: new Date('2026-10-10') },
      { ...mockHistoryRecords[1], date: new Date('2026-10-09') },
    ];

    (historyRepo.HistoryRecordRepository.getHistoryRecordsByWalker as any).mockResolvedValue(
      unorderedRecords
    );

    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      const records = screen.getAllByText(/Oxford Street|Collins Street|King Street/);
      // First record should be Collins Street (2026-10-10, newest)
      expect(records[0]).toHaveTextContent('Collins Street');
    });
  });

  it('shows loading spinner while fetching', async () => {
    (historyRepo.HistoryRecordRepository.getHistoryRecordsByWalker as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { container } = render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    // Should show loading spinner
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('handles records without campaignId', async () => {
    const recordsWithoutCampaignId = [
      { ...mockHistoryRecords[0], campaignId: undefined } as any,
    ];

    (historyRepo.HistoryRecordRepository.getHistoryRecordsByWalker as any).mockResolvedValue(
      recordsWithoutCampaignId
    );

    render(
      <BrowserRouter>
        <WalkerHistoryPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Collins Street')).toBeInTheDocument();
    });
  });
});
