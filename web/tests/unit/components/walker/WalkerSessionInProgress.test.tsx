import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalkerSessionInProgress from '../../../../src/components/walker/WalkerSessionInProgress';
import type { DoorData } from '../../../../src/models/door';
import type { PrintoutData } from '../../../../src/models/printout';

const mockDoor: DoorData & { id: string } = {
  id: 'door-1',
  address: '42 Collins Street',
  streetName: 'Collins Street',
  houseNumber: '42',
  status: 'pending',
  lat: -33.8688,
  lng: 151.2093,
};

const mockPrintout: PrintoutData & { id: string } = {
  id: 'flyer-1',
  name: 'Amazing Local Deals',
  version: 1,
  createdAt: new Date(),
  createdBy: 'user-1',
};

describe('WalkerSessionInProgress', () => {
  let onDoorDelivered: ReturnType<typeof vi.fn>;
  let onSkipDoor: ReturnType<typeof vi.fn>;
  let onShowDoorDetails: ReturnType<typeof vi.fn>;
  let onReportDoor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onDoorDelivered = vi.fn();
    onSkipDoor = vi.fn();
    onShowDoorDetails = vi.fn();
    onReportDoor = vi.fn();
  });

  it('renders delivery progress header', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('displays progress bar correctly', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={10}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const progressBar = screen.getByRole('region')?.querySelector('.h-full.bg-white');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('displays GPS confidence indicator', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        gpsAccuracy={8}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText(/±8m \(excellent\)/)).toBeInTheDocument();
  });

  it('shows GPS confidence as good', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        gpsAccuracy={20}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText(/±20m \(good\)/)).toBeInTheDocument();
  });

  it('shows GPS confidence as fair', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        gpsAccuracy={35}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText(/±35m \(fair\)/)).toBeInTheDocument();
  });

  it('shows GPS confidence as poor', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        gpsAccuracy={75}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText(/±75m \(poor\)/)).toBeInTheDocument();
  });

  it('displays active flyer reference panel', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        activePrintout={mockPrintout}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Active Flyer')).toBeInTheDocument();
    expect(screen.getByText('Amazing Local Deals')).toBeInTheDocument();
  });

  it('displays next door card with address', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Next Door')).toBeInTheDocument();
    expect(screen.getByText(/42 Collins Street/)).toBeInTheDocument();
  });

  it('displays distance indicator', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText(/Distance/)).toBeInTheDocument();
    expect(screen.getByText(/45m/)).toBeInTheDocument();
  });

  it('calls onDoorDelivered when delivered button clicked', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const deliveredButton = screen.getByText(/✓ Delivered/);
    fireEvent.click(deliveredButton);

    expect(onDoorDelivered).toHaveBeenCalledWith(mockDoor.id);
  });

  it('calls onSkipDoor with reason when skip button clicked', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const skipButton = screen.getByText('Skip');
    fireEvent.click(skipButton);

    expect(onSkipDoor).toHaveBeenCalledWith(mockDoor.id, 'user-skip');
  });

  it('calls onReportDoor when report button clicked', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
        onReportDoor={onReportDoor}
      />
    );

    const reportButton = screen.getByText('Report');
    fireEvent.click(reportButton);

    expect(onReportDoor).toHaveBeenCalledWith(mockDoor.id);
  });

  it('calls onShowDoorDetails when details button clicked', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const detailsButton = screen.getByText('Details');
    fireEvent.click(detailsButton);

    expect(onShowDoorDetails).toHaveBeenCalledWith(mockDoor);
  });

  it('displays exception state for GPS lost', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="gps_lost"
        exceptionMessage="GPS signal not available"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('GPS signal lost')).toBeInTheDocument();
    expect(screen.getByText('GPS signal not available')).toBeInTheDocument();
  });

  it('displays exception state for out of range', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={null}
        distanceToNext={null}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="out_of_range"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Out of delivery range')).toBeInTheDocument();
  });

  it('displays exception state for sync failed', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="sync_failed"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Connection issue')).toBeInTheDocument();
    expect(screen.getByText(/Reconnecting to server/)).toBeInTheDocument();
  });

  it('displays exception state for no junk mail', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="no_junk_mail_skipped"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('No Junk Mail')).toBeInTheDocument();
  });

  it('displays exception state for unknown eligibility', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="unknown_eligibility"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Property type unknown')).toBeInTheDocument();
  });

  it('displays exception state for inaccessible', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="inaccessible"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Inaccessible address')).toBeInTheDocument();
  });

  it('displays exception state for wrong location', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        exception="wrong_location"
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('Location mismatch')).toBeInTheDocument();
  });

  it('shows no nearby doors message when no next door', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={null}
        distanceToNext={null}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('No nearby doors')).toBeInTheDocument();
  });

  it('disables deliver button when syncing', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        syncing={true}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const deliveredButton = screen.getByText(/Syncing.../);
    expect(deliveredButton).toBeDisabled();
  });

  it('displays stats at bottom', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={2.5}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    expect(screen.getByText('2.50km')).toBeInTheDocument();
    expect(screen.getByText(/Distance/)).toBeInTheDocument();
    expect(screen.getByText(/Time/)).toBeInTheDocument();
    expect(screen.getByText(/Pace/)).toBeInTheDocument();
  });

  it('has touch-friendly button sizes', () => {
    render(
      <WalkerSessionInProgress
        nextDoor={mockDoor}
        distanceToNext={45}
        delivered={5}
        totalDoors={20}
        distanceWalked={1.2}
        elapsedMinutes={15}
        onDoorDelivered={onDoorDelivered}
        onSkipDoor={onSkipDoor}
        onShowDoorDetails={onShowDoorDetails}
      />
    );

    const deliveredButton = screen.getByText(/✓ Delivered/);
    expect(deliveredButton).toHaveClass('py-4');
  });
});
