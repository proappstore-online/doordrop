import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import DeliveryReadinessCheck from '../../../../src/components/mobile/DeliveryReadinessCheck';

describe('DeliveryReadinessCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    // Component returns null (callback-driven)
    expect(onStateChange).toHaveBeenCalled();
  });

  it('detects campaign closed state', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={true}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    expect(onStateChange).toHaveBeenCalledWith('campaign-closed');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('detects no-flyer state', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={false}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    expect(onStateChange).toHaveBeenCalledWith('no-flyer');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('detects no-doors state', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={0}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    expect(onStateChange).toHaveBeenCalledWith('no-doors');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('detects offline state', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    expect(onStateChange).toHaveBeenCalledWith('offline');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('sets initial state to checking', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    // First call should be 'checking'
    expect(onStateChange).toHaveBeenNthCalledWith(1, 'checking');
  });

  it('handles geolocation permission denied', async () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (success, error) => {
        if (error) {
          const mockError = new Error('Permission denied') as any;
          mockError.code = 1; // PERMISSION_DENIED
          error(mockError);
        }
      }
    );

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    // Wait for async geolocation check
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onStateChange).toHaveBeenCalledWith('permission-denied');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('handles offline event', () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    // Reset mock to track only new calls
    onStateChange.mockClear();

    // Simulate offline event
    window.dispatchEvent(new Event('offline'));

    // Should re-run check with offline state
    expect(onStateChange).toHaveBeenCalledWith('offline');
  });

  it('detects inaccurate GPS (>50m)', async () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (success) => {
        success({
          coords: {
            latitude: -33.8,
            longitude: 151.2,
            accuracy: 100, // More than 50m
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    );

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onStateChange).toHaveBeenCalledWith('inaccurate-gps');
    expect(onReady).not.toHaveBeenCalled();
  });

  it('reaches ready state with accurate GPS', async () => {
    const onReady = vi.fn();
    const onStateChange = vi.fn();

    vi.spyOn(navigator.geolocation, 'getCurrentPosition').mockImplementation(
      (success) => {
        success({
          coords: {
            latitude: -33.8,
            longitude: 151.2,
            accuracy: 25, // Less than 50m
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    );

    render(
      <DeliveryReadinessCheck
        hasFlyer={true}
        doorCount={10}
        isCampaignClosed={false}
        onReady={onReady}
        onStateChange={onStateChange}
      />
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(onStateChange).toHaveBeenCalledWith('ready');
    expect(onReady).toHaveBeenCalled();
  });
});
