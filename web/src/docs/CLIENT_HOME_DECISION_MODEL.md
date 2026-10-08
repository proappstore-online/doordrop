# Client Home Decision Model (Issue #44)

## Overview

This document defines how campaigns are presented in the client portfolio (dashboard). It's the source of truth for:
- Which campaign states exist and their meaning
- What requires client attention
- Campaign card hierarchy and content
- Empty/loading/error state handling
- Responsive layout guidance
- Accessibility requirements

**Source of truth implementation**: `web/src/models/clientHomeDecisionModel.ts`

## Campaign-State Matrix

All campaigns belong to exactly one portfolio section, based on their current status and attention flags.

```
Status          | Section              | Meaning                              | Visible?
─────────────────────────────────────────────────────────────────────────────────
draft           | BLOCKED              | Missing critical fields              | Top (needs action)
draft           | ATTENTION_NEEDED     | Has no flyer selected                | Top (needs action)
draft           | DRAFT                | Ready to publish                     | Middle
ready           | ACTIVE               | Published, awaiting walker           | Top (ongoing)
assigned        | ACTIVE               | Delivery in progress                 | Top (ongoing)
complete        | COMPLETED            | Delivery finished                    | Bottom (historical)
review          | ATTENTION_NEEDED     | Awaiting client approval             | Top (needs action)
payment         | ATTENTION_NEEDED     | Awaiting payment confirmation        | Top (needs action)
archive         | COMPLETED            | Archived (closed)                    | Bottom (historical)
```

### Portfolio Sections (Render Order)

1. **ATTENTION_NEEDED** (First) - Campaigns requiring immediate client action
   - Draft campaigns with no flyer
   - Campaigns in review/payment status
   - Campaigns past their due date

2. **BLOCKED** (Second) - Campaigns that cannot proceed
   - Draft campaigns with no delivery area defined
   - Other critical missing fields

3. **ACTIVE** (Third) - Campaigns in motion
   - Ready: Published, awaiting walker assignment
   - Assigned: Delivery in progress

4. **DRAFT** (Fourth) - Campaigns being prepared
   - Draft campaigns that are otherwise complete

5. **COMPLETED** (Last) - Historical campaigns
   - Complete, review, payment, archive statuses

**Rationale**: Clients see "what needs my attention" first, then "what's happening now", then "what I'm working on", then "what's done".

## Attention-State Matrix

Attention flags indicate a campaign needs client awareness or action. Multiple flags can apply.

```
Flag                      | Trigger                              | Severity | Section
───────────────────────────────────────────────────────────────────────────────
NO_DELIVERY_AREA          | status=draft && no lat/lng           | CRITICAL | BLOCKED
NO_FLYER                  | status=draft && no activePrintoutId  | HIGH     | ATTENTION_NEEDED
AWAITING_APPROVAL         | status in (review, payment)          | HIGH     | ATTENTION_NEEDED
WALKER_NEEDED             | status=ready && no assignedWalkerId  | MEDIUM   | ACTIVE
PAST_DUE                  | dueDate < now                        | MEDIUM   | ATTENTION_NEEDED
NO_DELIVERY_PROGRESS      | status=assigned && no deliveries     | MEDIUM   | ACTIVE (future)
```

### Priority Order (Severity)

When displaying a single "primary attention" badge on a card:

1. NO_DELIVERY_AREA (blocks publishing)
2. AWAITING_APPROVAL (waiting on client)
3. NO_FLYER (can't publish)
4. PAST_DUE (timeline issue)
5. WALKER_NEEDED (can't deliver)
6. NO_DELIVERY_PROGRESS (stalled)

## Campaign Card Content Inventory

### Mobile Layout (< 768px)

Minimal view to keep cards scannable on phones:

```
┌─────────────────────────────────────┐
│ Campaign Name                    [S]│  S = Status badge
│ Suburb, Postcode                    │
│                                     │
│ [Primary Action Button]             │
└─────────────────────────────────────┘
```

**Always shown**:
- Campaign name (truncate if needed)
- Suburb + postcode (single line)
- Status badge with color
- Attention badge (if any flag present)
- Primary action button

**Hidden on mobile**:
- Flyer name
- Walker name
- Door count
- Budget
- Due date
- Delivery progress bar
- Street address (shown in desktop location line)

**Accessibility**: Tap anywhere on the card or the action button to open campaign detail.

### Desktop Layout (≥ 768px)

Full view with all relevant details:

```
┌──────────────────────────────────────────────────────────┐
│ Campaign Name                            [Status] [Alert]│
│ Street Name · Suburb, Postcode                           │
│                                                          │
│ 150 doors · $1,500 budget · Due Nov 15                   │
│ Flyer: Summer Sale · Walker: John Doe                    │
│ Progress: 125/150 delivered (83%)                        │
│                                                          │
│ [Manage campaign →]                                      │
└──────────────────────────────────────────────────────────┘
```

**Additional on desktop**:
- Street address (multiline location)
- Door count + budget + due date in a metrics row
- Flyer name and status
- Assigned walker name (or "Looking for walker")
- Delivery progress bar (if assigned)
- Text description of primary action

### Content Rules

| Field              | Rule                                                   |
|--------------------|--------------------------------------------------------|
| campaignName       | Always shown, truncate to 1 line                       |
| location           | Mobile: "Suburb, Postcode"; Desktop: "Street · Suburb" |
| status             | Always shown as badge with semantic color              |
| attentionBadge     | Shown if any flag present; use primary flag            |
| doorCount          | Optional; show if > 0 and status is active/complete    |
| budget             | Optional; show if > 0                                  |
| dueDate            | Optional; format as "Due Nov 15"; hide if past         |
| flyerName          | Desktop only; show selected flyer or "No flyer"        |
| walkerName         | Desktop only; show assigned walker or "Looking..."    |
| deliveryProgress   | Desktop only; show if status=assigned                 |
| primaryAction      | Href: `/app/campaign/{campaignId}` in all cases        |

## Empty / Loading / Error States

### PortfolioLoadingState Enum

```typescript
LOADING         // Fetching campaigns from server
ERROR           // Network or server error occurred
EMPTY_FIRST_TIME // User has never created a campaign
EMPTY_ACTIVE_ONLY // No active/draft campaigns, but has completed
READY           // Campaigns loaded and ready to display
```

### Empty State (First-Time User)

**Trigger**: No campaigns exist and user has just signed in.

**UI**:
```
┌─────────────────────────────────────┐
│        Create your first campaign   │
│                                     │
│  Choose the suburb you want to      │
│  reach, add delivery areas, then    │
│  publish when it's ready for a      │
│  walker.                            │
│                                     │
│  [Create a Campaign] [Upload Flyer] │
└─────────────────────────────────────┘
```

**Action items**:
- Link to campaign setup wizard
- Link to flyer upload

**Accessibility**: Role="status", aria-label="No campaigns"

### Loading State

**Trigger**: Campaigns are being fetched from the server.

**UI**: Centered spinner with label "Loading campaigns"

**Accessibility**: Role="status", aria-label="Loading campaigns", aria-live="polite"

### Error State

**Trigger**: Network error or server error while fetching campaigns.

**UI**:
```
┌─────────────────────────────────────┐
│   Unable to load campaigns          │
│                                     │
│   We couldn't load your campaigns.  │
│   Check your connection and try     │
│   again.                            │
│                                     │
│   [Try Again]                       │
└─────────────────────────────────────┘
```

**Action**: Retry button calls the load function again.

**Accessibility**: Role="alert", aria-live="assertive", aria-label="Error loading campaigns"

### Empty Active (No Current Work)

**Trigger**: User has completed campaigns but no active/draft campaigns.

**UI**: Show COMPLETED section with message "No active campaigns. Create one when you're ready to plan your next delivery."

**Action**: Link to campaign setup wizard prominent in top bar.

## Responsive Behavior

### Grid Layout

- **Mobile** (< 640px): Single column, full-width cards
- **Tablet** (640px - 1024px): 2-column grid
- **Desktop** (≥ 1024px): 3-column grid with max-width container

### Touch Targets

- **Minimum tap target**: 44×44 px (WCAG AAA)
- **Status badge**: Clickable, links to campaign detail
- **Attention badge**: Clickable, shows tooltip with description
- **Card**: Entire card is a clickable link (semantic anchor)

### Text Truncation

- Campaign name: 1 line max (ellipsis)
- Location: 2 lines max on mobile, 1 line on desktop
- Metrics row: Wrap on smaller screens

## Accessibility Requirements

### Semantic HTML

- Portfolio container: `<main role="main" aria-label="Campaign portfolio">`
- Section headings: `<h2>` with aria-label including count
- Campaign cards: `<article role="article" aria-label="...">`
- Attention badges: `<span role="status" aria-label="...">`

### Color & Contrast

- Status badges: Sufficient color contrast (WCAG AA minimum)
- Attention badges: Red/orange background with white text
- Text on status badges: Always meet WCAG AA (4.5:1) contrast

### Keyboard Navigation

- Tab through campaign cards in visual order (left-to-right, top-to-bottom)
- Enter to open campaign detail
- Focus indicators visible on all interactive elements
- Links use semantic `<a>` tags

### Screen Readers

- Section counts announced: "Active campaigns (3)"
- Attention flags described: "Attention needed: No flyer selected"
- Loading state: aria-live="polite"
- Error state: aria-live="assertive"

### Mobile Accessibility

- Touch targets at least 44×44 px
- No hover-only content
- Gestures have keyboard alternatives

## Next Actions Hierarchy

For each campaign state, define the primary action path:

```
draft + no_flyer        → "Select flyer" → /app/campaign/{id}
draft + no_delivery_area → "Add delivery area" → /app/campaign/{id}
draft (complete)        → "Publish" → /app/campaign/{id}
ready + walker_needed   → "Assign walker" → /app/campaign/{id}
assigned                → "Track delivery" → /app/campaign/{id}
review                  → "Approve delivery" → /app/campaign/{id}
payment                 → "Confirm payment" → /app/campaign/{id}
complete                → "Leave review" → /app/campaign/{id}
archive                 → "View archived" → /app/campaign/{id}
```

All primary actions link to the campaign detail page (`/app/campaign/{campaignId}`).

## Testing Checklist

### Functional

- [ ] Campaign sections render in correct order
- [ ] Attention flags compute correctly for all status combinations
- [ ] Portfolio state machine handles loading/error/empty transitions
- [ ] Campaign sorting by last-updated works within sections
- [ ] Responsive grid layouts stack correctly

### Accessibility

- [ ] All sections have proper heading levels (h2)
- [ ] Attention badges have descriptive aria-labels
- [ ] Loading state announces "Loading campaigns" to screen readers
- [ ] Error state shows alert role with error message
- [ ] Keyboard navigation works through all cards
- [ ] Focus indicators visible on all interactive elements
- [ ] Minimum tap targets 44×44 px on mobile

### Visual (Manual)

- [ ] Status badge colors match `campaignStatusColors.ts`
- [ ] Attention badges are visually distinct (color + icon)
- [ ] Cards have hover states (shadow, border color)
- [ ] Mobile layout is single-column, not cramped
- [ ] Desktop layout shows all fields without clipping
- [ ] Dark mode contrast acceptable

### Responsive

- [ ] Single column on mobile (< 640px)
- [ ] 2 columns on tablet (640px - 1024px)
- [ ] 3 columns on desktop (≥ 1024px)
- [ ] Text reflows without horizontal scroll
- [ ] Images (flyer previews) scale correctly

## Usage Example

```typescript
import { computePortfolioState, getCampaignSection } from '../models/clientHomeDecisionModel';

// Compute portfolio state
const portfolio = computePortfolioState(campaigns, loading, error);

// Render by section
Object.entries(portfolio.sections).forEach(([section, campaignsInSection]) => {
  if (campaignsInSection.length === 0) return; // Skip empty sections
  
  return (
    <section key={section}>
      <h2>{section}</h2>
      {campaignsInSection.map(campaign => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </section>
  );
});
```

## References

- **Lifecycle State Machine**: Issue #48 (defines valid status transitions)
- **Campaign Model**: `web/src/models/campaign.ts`
- **Status Colors**: `web/src/utils/campaignStatusColors.ts`
- **Campaign Repository**: `web/src/repositories/campaignRepository.ts`
- **Client Dashboard**: `web/src/pages/client/ClientDashboard.tsx`
- **Parent Epic**: Issue #29 (Client home redesign)
