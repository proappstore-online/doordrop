import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConnectionBanner from '../../../../src/components/mobile/ConnectionBanner';

describe('ConnectionBanner', () => {
  beforeEach(() => {
    // Reset navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('does not show when online and alwaysShow is false', () => {
    const { container } = render(<ConnectionBanner alwaysShow={false} />);
    expect(container.firstChild).toHaveClass('hidden');
  });

  it('shows when alwaysShow is true', () => {
    render(<ConnectionBanner alwaysShow={true} />);
    expect(screen.getByText('Back online')).toBeInTheDocument();
  });

  it('shows offline message when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<ConnectionBanner />);
    expect(screen.getByText('Offline mode')).toBeInTheDocument();
  });

  it('has status role for accessibility', () => {
    render(<ConnectionBanner alwaysShow={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live polite for announcements', () => {
    render(<ConnectionBanner alwaysShow={true} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('dark mode support', () => {
    render(<ConnectionBanner alwaysShow={true} />);

    const banner = screen.getByRole('status').parentElement;
    expect(banner).toHaveClass('dark:bg-emerald-900/30');
  });

  it('shows WiFi icon when online', () => {
    render(<ConnectionBanner alwaysShow={true} />);

    const icon = screen.getByRole('status').querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('responds to online/offline events', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const { rerender } = render(<ConnectionBanner alwaysShow={true} />);

    let banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Back online');

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    fireEvent.offline(window);

    // Re-render to see updated state
    rerender(<ConnectionBanner alwaysShow={true} />);
  });
});
