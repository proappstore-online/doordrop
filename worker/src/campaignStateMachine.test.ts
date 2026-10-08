import { describe, it, expect } from 'vitest';
import { canTransition, getTransitionError, isFieldMutable, getNextActions, getCampaignStatusLabel } from './campaignStateMachine.js';
import type { CampaignStatus, ActorRole } from './campaignStateMachine.js';

describe('campaignStateMachine', () => {
  describe('canTransition', () => {
    it('allows draft -> ready for campaign admin', () => {
      expect(canTransition('draft', 'ready', 'campaign_admin')).toBe(true);
    });

    it('denies draft -> ready for assigned walker', () => {
      expect(canTransition('draft', 'ready', 'assigned_walker')).toBe(false);
    });

    it('allows ready -> draft for campaign admin (unpublish)', () => {
      expect(canTransition('ready', 'draft', 'campaign_admin')).toBe(true);
    });

    it('allows ready -> assigned for platform admin', () => {
      expect(canTransition('ready', 'assigned', 'platform_admin')).toBe(true);
    });

    it('allows ready -> assigned for campaign admin', () => {
      expect(canTransition('ready', 'assigned', 'campaign_admin')).toBe(true);
    });

    it('allows assigned -> complete for platform admin', () => {
      expect(canTransition('assigned', 'complete', 'platform_admin')).toBe(true);
    });


    it('allows complete -> review for platform admin', () => {
      expect(canTransition('complete', 'review', 'platform_admin')).toBe(true);
    });

    it('allows review -> payment for platform admin', () => {
      expect(canTransition('review', 'payment', 'platform_admin')).toBe(true);
    });

    it('allows payment -> archive for platform admin', () => {
      expect(canTransition('payment', 'archive', 'platform_admin')).toBe(true);
    });

    it('allows any state -> archive for platform admin', () => {
      const states: CampaignStatus[] = ['draft', 'ready', 'assigned', 'complete', 'review', 'payment'];
      states.forEach((state) => {
        expect(canTransition(state, 'archive', 'platform_admin')).toBe(true);
      });
    });

    it('denies archive -> archive for campaign admin', () => {
      expect(canTransition('archive', 'archive', 'campaign_admin')).toBe(true); // no-op allowed
    });

    it('allows no-op transitions (same status)', () => {
      const statuses: CampaignStatus[] = ['draft', 'ready', 'assigned', 'complete', 'review', 'payment', 'archive'];
      statuses.forEach((status) => {
        expect(canTransition(status, status, 'campaign_admin')).toBe(true);
        expect(canTransition(status, status, 'platform_admin')).toBe(true);
        expect(canTransition(status, status, 'assigned_walker')).toBe(true);
      });
    });

    it('denies invalid transitions', () => {
      expect(canTransition('archive', 'draft', 'platform_admin')).toBe(false);
      expect(canTransition('complete', 'draft', 'platform_admin')).toBe(false);
      expect(canTransition('assigned', 'draft', 'platform_admin')).toBe(false);
    });
  });

  describe('getTransitionError', () => {
    it('returns null for valid transitions', () => {
      expect(getTransitionError('draft', 'ready', 'campaign_admin')).toBeNull();
    });

    it('returns error for role violations', () => {
      const error = getTransitionError('draft', 'ready', 'assigned_walker');
      expect(error).toMatch(/cannot transition/i);
    });

    it('returns error for invalid transitions', () => {
      const error = getTransitionError('archive', 'draft', 'platform_admin');
      expect(error).toMatch(/cannot transition/i);
    });
  });

  describe('isFieldMutable', () => {
    it('allows mutation in draft status', () => {
      expect(isFieldMutable('door_radius_m', 'draft', 'campaign_admin')).toBe(true);
      expect(isFieldMutable('suburb', 'draft', 'campaign_admin')).toBe(true);
    });

    it('allows mutation in ready status', () => {
      expect(isFieldMutable('door_radius_m', 'ready', 'campaign_admin')).toBe(true);
    });

    it('denies mutation of draft fields in assigned status for campaign admin', () => {
      expect(isFieldMutable('door_radius_m', 'assigned', 'campaign_admin')).toBe(false);
      expect(isFieldMutable('suburb', 'assigned', 'campaign_admin')).toBe(false);
    });

    it('allows mutation of draft fields in assigned status for platform admin', () => {
      expect(isFieldMutable('door_radius_m', 'assigned', 'platform_admin')).toBe(true);
      expect(isFieldMutable('suburb', 'assigned', 'platform_admin')).toBe(true);
    });

    it('denies mutation of draft fields in archive status for all roles', () => {
      expect(isFieldMutable('door_radius_m', 'archive', 'campaign_admin')).toBe(false);
      expect(isFieldMutable('door_radius_m', 'archive', 'platform_admin')).toBe(false);
    });

    it('allows mutation of non-draft fields in assigned status', () => {
      expect(isFieldMutable('name', 'assigned', 'campaign_admin')).toBe(true);
      expect(isFieldMutable('budget', 'assigned', 'campaign_admin')).toBe(true);
    });
  });

  describe('getNextActions', () => {
    it('returns correct next actions for draft campaign admin', () => {
      const actions = getNextActions('draft', 'campaign_admin');
      expect(actions).toContain('ready');
      expect(actions).toContain('assigned');
    });

    it('returns correct next actions for ready campaign admin', () => {
      const actions = getNextActions('ready', 'campaign_admin');
      expect(actions).toContain('draft');
    });

    it('returns correct next actions for ready platform admin', () => {
      const actions = getNextActions('ready', 'platform_admin');
      expect(actions).toContain('assigned');
      expect(actions).toContain('archive');
    });

    it('returns empty for archived campaigns', () => {
      const actions = getNextActions('archive', 'campaign_admin');
      expect(actions).toHaveLength(0);
    });
  });

  describe('getCampaignStatusLabel', () => {
    it('returns correct labels', () => {
      expect(getCampaignStatusLabel('draft')).toBe('Draft');
      expect(getCampaignStatusLabel('ready')).toBe('Published');
      expect(getCampaignStatusLabel('assigned')).toBe('Assigned');
      expect(getCampaignStatusLabel('complete')).toBe('Completed');
      expect(getCampaignStatusLabel('review')).toBe('In Review');
      expect(getCampaignStatusLabel('payment')).toBe('Payment Pending');
      expect(getCampaignStatusLabel('archive')).toBe('Archived');
    });
  });
});
