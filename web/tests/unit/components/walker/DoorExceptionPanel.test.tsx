import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DoorExceptionPanel from '../../../../src/components/walker/DoorExceptionPanel';
import type { DoorData } from '../../../../src/models/door';

const mockDoor: DoorData & { id: string } = {
  id: 'door-1',
  address: '42 Collins Street',
  streetName: 'Collins Street',
  houseNumber: '42',
  status: 'pending',
  lat: -33.8688,
  lng: 151.2093,
};

describe('DoorExceptionPanel', () => {
  let onSkip: ReturnType<typeof vi.fn>;
  let onReport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSkip = vi.fn();
    onReport = vi.fn();
  });

  it('renders no-junk-mail exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('No Junk Mail')).toBeInTheDocument();
    expect(screen.getByText(/requested no unsolicited mail/)).toBeInTheDocument();
  });

  it('renders inaccessible exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="inaccessible"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('Inaccessible')).toBeInTheDocument();
    expect(screen.getByText(/Cannot access/)).toBeInTheDocument();
  });

  it('renders wrong-location exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="wrong-location"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('Wrong Location')).toBeInTheDocument();
    expect(screen.getByText(/location seems incorrect/)).toBeInTheDocument();
  });

  it('renders manual-report exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="manual-report"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('Report Issue')).toBeInTheDocument();
    expect(screen.getByText(/Describe what happened/)).toBeInTheDocument();
  });

  it('renders skipped exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="skipped"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('Skipped')).toBeInTheDocument();
    expect(screen.getByText(/continue to next door/)).toBeInTheDocument();
  });

  it('calls onSkip for no-junk-mail primary action', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const primaryButton = screen.getByLabelText('Skip Delivery');
    fireEvent.click(primaryButton);

    expect(onSkip).toHaveBeenCalledWith(mockDoor.id, 'no-junk-mail');
  });

  it('calls onReport for inaccessible primary action', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="inaccessible"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const primaryButton = screen.getByLabelText('Report Issue');
    fireEvent.click(primaryButton);

    expect(onReport).toHaveBeenCalledWith(mockDoor.id);
  });

  it('calls onSkip for inaccessible secondary action', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="inaccessible"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const secondaryButton = screen.getByLabelText('Try Again');
    fireEvent.click(secondaryButton);

    expect(onSkip).toHaveBeenCalledWith(mockDoor.id, 'inaccessible');
  });

  it('displays door address in panel', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByText('42 Collins Street')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
        isLoading={true}
      />
    );

    const primaryButton = screen.getByLabelText('Skip Delivery');
    expect(primaryButton).toBeDisabled();
  });

  it('shows loading state on button', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
        isLoading={true}
      />
    );

    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('has two buttons for inaccessible exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="inaccessible"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByLabelText('Report Issue')).toBeInTheDocument();
    expect(screen.getByLabelText('Try Again')).toBeInTheDocument();
  });

  it('has one button for no-junk-mail exception', () => {
    render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    expect(screen.getByLabelText('Skip Delivery')).toBeInTheDocument();
    expect(screen.getByLabelText('Proceed Anyway')).toBeInTheDocument();
  });

  it('uses blue color scheme for no-junk-mail', () => {
    const { container } = render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="no-junk-mail"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const panel = container.querySelector('div[class*="blue-50"]');
    expect(panel).toBeInTheDocument();
  });

  it('uses amber color scheme for inaccessible', () => {
    const { container } = render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="inaccessible"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const panel = container.querySelector('div[class*="amber-50"]');
    expect(panel).toBeInTheDocument();
  });

  it('uses red color scheme for manual-report', () => {
    const { container } = render(
      <DoorExceptionPanel
        door={mockDoor}
        exceptionType="manual-report"
        onSkip={onSkip}
        onReport={onReport}
      />
    );

    const panel = container.querySelector('div[class*="red-50"]');
    expect(panel).toBeInTheDocument();
  });
});
