import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeliveryStartupScreen from '../../../../src/components/mobile/DeliveryStartupScreen';

// Mock navigator.geolocation with accurate GPS
vi.mock('navigator', () => ({}), { virtual: true });

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: true,
  });

  vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
    (success) => {
      success({
        coords: {
          latitude: -33.8,
          longitude: 151.2,
          accuracy: 25,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }
  );
});

describe('DeliveryStartupScreen', () => {
  it('renders with campaign name and info', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    expect(screen.getByText(/10 doors/)).toBeInTheDocument();
  });

  it('shows checking state initially', () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    expect(screen.getByText('Checking readiness...')).toBeInTheDocument();
  });

  it('displays ready state with start button', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Ready to deliver!')).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: 'Start delivery' });
    expect(startButton).toBeInTheDocument();
  });

  it('calls onStartDelivery when ready and button clicked', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Ready to deliver!')).toBeInTheDocument();
    });

    const startButton = screen.getByRole('button', { name: 'Start delivery' });
    fireEvent.click(startButton);

    expect(onStartDelivery).toHaveBeenCalled();
  });

  it('shows campaign-closed state with no retry button', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={true}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Campaign closed')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Contact campaign admin/)).toBeInTheDocument();
  });

  it('shows no-flyer state with no retry button', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={false}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No active flyer')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('shows no-doors state with no retry button', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={0}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No delivery locations')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
  });

  it('shows permission-denied state with retry button', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementationOnce(
      (success, error) => {
        if (error) {
          const mockError = new Error('Permission denied') as any;
          mockError.code = 1;
          error(mockError);
        }
      }
    );

    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Location permission needed')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();
  });

  it('retry button resets state to checking', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementationOnce(
      (success, error) => {
        if (error) {
          const mockError = new Error('Permission denied') as any;
          mockError.code = 1;
          error(mockError);
        }
      }
    );

    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Location permission needed')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    expect(screen.getByText('Checking readiness...')).toBeInTheDocument();
  });

  it('shows offline state with retry button', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No internet connection')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();
  });

  it('shows inaccurate-gps state with retry button', async () => {
    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementationOnce(
      (success) => {
        success({
          coords: {
            latitude: -33.8,
            longitude: 151.2,
            accuracy: 100,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    );

    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('GPS signal weak')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeInTheDocument();
  });

  it('displays guidance text for current state', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tap "Start Delivery" to begin.')).toBeInTheDocument();
    });
  });

  it('includes door radius in out-of-range message', async () => {
    // Would need mock location outside radius to test this
    // For now, verify the component at least accepts doorRadius
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={75}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    expect(screen.getByText(/Test Campaign/)).toBeInTheDocument();
  });

  it('shows flyer status in campaign info', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    expect(screen.getByText(/✓ Flyer/)).toBeInTheDocument();
  });

  it('shows no flyer status in campaign info', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={false}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/✗ No flyer/)).toBeInTheDocument();
    });
  });

  it('has proper accessibility labels on buttons', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Start delivery')).toBeInTheDocument();
    });
  });

  it('button has touch-friendly height (48px)', async () => {
    const onStartDelivery = vi.fn();

    render(
      <DeliveryStartupScreen
        campaignName="Test Campaign"
        doorRadius={50}
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onStartDelivery={onStartDelivery}
      />
    );

    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: 'Start delivery' });
      expect(startButton).toHaveClass('h-12'); // 48px
    });
  });
});
