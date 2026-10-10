import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalkerSessionEndScreen from '../../../../src/components/walker/WalkerSessionEndScreen';

describe('WalkerSessionEndScreen', () => {
  it('renders completed session summary', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText(/doors delivered/)).toBeInTheDocument();
    expect(screen.getByText(/2.50 km/)).toBeInTheDocument();
  });

  it('displays sync state as synced', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('All deliveries synced')).toBeInTheDocument();
    expect(screen.getByText(/safely stored on our servers/)).toBeInTheDocument();
  });

  it('displays sync state as syncing', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="syncing"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Syncing deliveries...')).toBeInTheDocument();
    expect(screen.getByText(/stay connected/)).toBeInTheDocument();
  });

  it('displays sync state as partial with pending count', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="partial"
        pendingSyncCount={3}
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('3 doors pending sync')).toBeInTheDocument();
    expect(screen.getByText(/still syncing/)).toBeInTheDocument();
  });

  it('displays sync state as failed with retry button', () => {
    const onRetrySyncCall = vi.fn();
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="failed"
        endReason="manual_stop"
        onRetrySyncCall={onRetrySyncCall}
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Sync failed')).toBeInTheDocument();
    const retryButton = screen.getByText('Retry Sync');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetrySyncCall).toHaveBeenCalled();
  });

  it('displays exception summary', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        exceptionSummary={{
          skipped: 2,
          inaccessible: 1,
          noJunkMail: 1,
          wrongLocation: 0,
        }}
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Exceptions encountered:')).toBeInTheDocument();
    expect(screen.getByText('Skipped: 2')).toBeInTheDocument();
    expect(screen.getByText('Inaccessible: 1')).toBeInTheDocument();
    expect(screen.getByText('No Junk Mail: 1')).toBeInTheDocument();
  });

  it('does not show exception summary when empty', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        exceptionSummary={{
          skipped: 0,
          inaccessible: 0,
          noJunkMail: 0,
          wrongLocation: 0,
        }}
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.queryByText('Exceptions encountered:')).not.toBeInTheDocument();
  });

  it('calculates success rate correctly', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={10}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('shows end reason for manual stop', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Delivery stopped')).toBeInTheDocument();
  });

  it('shows end reason for out of range', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="out_of_range"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Out of range')).toBeInTheDocument();
  });

  it('shows error details when provided', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        error="Network connection timeout"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Error details:')).toBeInTheDocument();
    expect(screen.getByText('Network connection timeout')).toBeInTheDocument();
  });

  it('shows resume button when canResume is true', () => {
    const onResume = vi.fn();
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onResume={onResume}
        canResume={true}
        onComplete={vi.fn()}
      />
    );

    const resumeButton = screen.getByText('Resume Delivery');
    expect(resumeButton).toBeInTheDocument();

    fireEvent.click(resumeButton);
    expect(onResume).toHaveBeenCalled();
  });

  it('hides resume button when canResume is false', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        canResume={false}
        onComplete={vi.fn()}
      />
    );

    expect(screen.queryByText('Resume Delivery')).not.toBeInTheDocument();
  });

  it('calls onComplete when Done button clicked', () => {
    const onComplete = vi.fn();
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={onComplete}
      />
    );

    const doneButton = screen.getByText('Done');
    fireEvent.click(doneButton);
    expect(onComplete).toHaveBeenCalled();
  });

  it('displays recovery options for GPS loss', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="gps_lost"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByText('Recovery options:')).toBeInTheDocument();
    expect(screen.getByText(/Move to an open area/)).toBeInTheDocument();
  });

  it('has accessibility labels on buttons', () => {
    render(
      <WalkerSessionEndScreen
        deliveredCount={15}
        totalDoors={20}
        totalDistance={2.5}
        totalDuration={30}
        syncState="synced"
        endReason="manual_stop"
        onComplete={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Done and go to campaigns')).toBeInTheDocument();
  });
});
