# Walker Field Usability Scenarios & Acceptance Checks

**Issue**: [#55](https://github.com/proappstore-online/doordrop/issues/55)

**Purpose**: Convert the walker delivery experience into observable field scenarios before large-scale UI changes. This checklist is used by product, design, and engineering to evaluate implementation tasks and verify field readiness.

---

## ⚠️ GPS/Location Hardware Requirement

**Critical note**: Geofence triggers, walking-pace validation, GPS accuracy, and battery behavior scenarios **cannot be automated in CI** and **must be tested on a real device**. Playwright can mock geolocation errors/denials, but cannot accurately simulate real GPS coordinates, geofence entry/exit, or pace detection. See the "GPS/Location Hardware Checks" section below for manual device test procedures.

---

## Field Usability Scenarios

### 1. First Sign-In & Role Selection

**Scenario**: A new walker opens the app for the first time and signs in via GitHub OAuth.

**Description**: 
- User taps "Sign in with GitHub"
- Platform OAuth redirects; user authorizes GitHub
- App redirects back to `/select-role`
- User selects "walker" role
- App redirects to `/walker` (campaigns list)

**Success Criteria**:
- OAuth completes without errors
- User is presented with role selection (not auto-assigned)
- After role selection, user sees `/walker` with campaign list
- User's profile badge shows in the top bar

**Safety Criteria**:
- Session is secure (uses platform session cookie, not token in localStorage)
- Role selection is idempotent (refreshing the page keeps the selection)
- User cannot access `/app` or `/admin` routes without proper roles

**Recovery Path**:
- If OAuth fails, show a clear error message and a "Retry sign in" button
- If role selection fails, allow user to return to role selection page

---

### 2. Geolocation Permission Denied by User

**Scenario**: Walker denies location access when prompted or has it disabled in device settings.

**Description**:
- Walker taps "Start Delivery" on an assigned campaign
- Browser prompts for geolocation permission
- Walker denies (or permission is already disabled in Settings)
- App receives `PermissionDenied` or `NotSupported` error from Geolocation API

**Success Criteria**:
- A clear, non-blocking error message appears: "Location access is required to deliver. Please enable location in your device settings and try again."
- Message includes actionable instruction (e.g., link to iOS/Android settings)
- Walker can dismiss the error and return to previous screen
- Walker can retry after granting permission

**Safety Criteria**:
- **App does NOT attempt to fake or mock a location**
- **No deliveries are marked as complete without real GPS data**
- Delivery state remains "assigned" (not "in_progress") if location is unavailable
- No geofence triggers, auto-delivery marks, or pace checks occur

**Recovery Path**:
- User enables location in device settings and returns to app
- User taps "Start Delivery" again
- Geolocation is re-requested; user grants permission
- Delivery begins normally

---

### 3. No Network / Offline During Browse

**Scenario**: Walker is browsing available campaigns but loses network connectivity (e.g., enters subway, tunnel, or WiFi drops).

**Description**:
- Walker is viewing `/walker` (campaigns list)
- Network connectivity is lost
- Walker attempts to scroll, filter, or tap a campaign

**Success Criteria**:
- A clear offline indicator banner appears (e.g., "You're offline – showing cached campaigns")
- Cached campaigns remain visible and tappable
- Attempting a network action (e.g., express interest) shows a tooltip: "You're offline – please reconnect"
- Banner disappears once network returns

**Safety Criteria**:
- No stale data is presented as current (e.g., campaign is actually full, but offline copy still shows "Join")
- Interest submissions fail gracefully and queue for retry (not silently dropped)

**Recovery Path**:
- Network reconnects (user leaves tunnel, reconnects to WiFi)
- Offline banner disappears
- Queued actions (interest submission) retry automatically
- User sees confirmation toast on success

---

### 4. Finding and Filtering a Campaign

**Scenario**: Walker browses the list of available campaigns, filters by suburb/distance, and finds one matching their criteria.

**Description**:
- Walker opens `/walker` (campaign list)
- On 320px mobile viewport, list is visible and responsive
- Walker can scroll through campaigns
- Each campaign card shows: suburb, street range, flyer image, walker count, distance (if available)
- Walker can tap a campaign to view details

**Success Criteria**:
- Campaign list renders correctly on 320px width (no text overflow, buttons clickable)
- Campaign cards are touch-friendly (min 44x44px tap target)
- Information hierarchy is clear (suburb first, distance visible)
- Pagination or infinite scroll works smoothly

**Safety Criteria**:
- Closed/inactive campaigns are not shown (state filter works)
- Campaign details match the backend (flyer, radius, postcode)

**Recovery Path**:
- If list fails to load, show retry button
- If filtering fails, show all campaigns or explain why filter is unavailable

---

### 5. Expressing Interest in a Campaign

**Scenario**: Walker views campaign details and expresses interest to be considered for delivery.

**Description**:
- Walker taps on a campaign from the list, views `/app/campaign/:id` (walker view)
- Walker sees "Express Interest" button
- Walker taps the button
- Backend records the interest (walker is added to interested_walker_ids)
- UI updates to show "Interest Expressed" or "Withdraw Interest"

**Success Criteria**:
- "Express Interest" button is present, visible, and clickable (min 44x44px)
- Button is disabled during submission (prevent double-clicks)
- On success, button text changes to "Interest Withdrawn" or similar
- A success toast or announcement confirms the action

**Safety Criteria**:
- Interest is only recorded once per walker per campaign
- Interest is not recorded if the user is already assigned
- Interest can be withdrawn by the same button

**Recovery Path**:
- If submission fails, show error message with "Retry" button
- If button state becomes out-of-sync with server, a refresh resets it correctly

---

### 6. Assignment Confirmation Received

**Scenario**: Client approves a walker's interest; walker receives notification and sees their status change to "assigned."

**Description**:
- Walker has expressed interest in a campaign
- Client approves the walker's interest (via `/app/campaign/:id` as client)
- Walker receives a notification (push or polling updates the badge)
- Walker views the campaign; status now shows "You're assigned"
- Walker can see "Start Delivery" button (was previously "Express Interest")

**Success Criteria**:
- Assignment is reflected in the UI within ~5 seconds (polling interval)
- Notification badge updates (if implemented)
- "Start Delivery" button is visible and enabled
- Assigned status is clear and prominent

**Safety Criteria**:
- Only one walker can be assigned to a single delivery per campaign
- Assignment status is read-only (walker cannot self-assign)
- Assignment persists across page refreshes

**Recovery Path**:
- If notification is missed, walker can see assignment status by refreshing campaign detail
- If "Start Delivery" is not visible, a manual refresh shows it

---

### 7. Late Start / Delayed Delivery Start

**Scenario**: Walker is assigned but does not start delivery immediately; they begin delivery hours or days later.

**Description**:
- Walker is assigned to a campaign with a delivery window (e.g., 9 AM – 5 PM)
- Walker returns to the app at 4:55 PM (5 minutes before window closes)
- Walker taps "Start Delivery"
- Delivery begins with reduced time remaining

**Success Criteria**:
- Delivery can be started within the campaign's time window
- App shows countdown timer or remaining time clearly
- Walker is aware of time pressure (e.g., "17 minutes remaining")
- No warnings or blocks occur due to late start

**Safety Criteria**:
- Delivery cannot be started after the campaign window closes (e.g., 5:01 PM if window closes at 5 PM)
- Client can see accurate delivery start time in the delivery history
- Walker cannot retroactively mark doors as delivered before delivery start time

**Recovery Path**:
- If walker misses the window, show message: "This campaign delivery window has closed. Contact the client to request an extension."
- If delivery is partially started, walker can pause and resume (if allowed by campaign rules)

---

### 8. Out-of-Range During Active Delivery

**Scenario**: Walker begins delivery but temporarily leaves the geofence (e.g., goes to a different street, takes a break, or drives instead of walking).

**Description**:
- Walker is actively delivering (in `/walker/delivery/:id`)
- GPS shows walker is within the campaign geofence at walking pace
- Walker walks to an adjacent street (outside the geofence radius)
- GPS updates; app detects walker is out-of-range
- User re-enters geofence

**Success Criteria**:
- Out-of-range detection does not immediately fail the delivery
- A warning or status message appears: "You've moved outside the delivery area. Return to continue."
- Walker can re-enter the geofence without restarting
- Delivery progress is preserved (marked doors remain marked)

**Safety Criteria**:
- Out-of-range status does NOT auto-mark any remaining doors as delivered
- If walker leaves and doesn't return within a time window (e.g., 30 min), delivery may auto-pause or timeout
- Geofence radius matches the campaign settings (no false positives)

**Recovery Path**:
- Walker re-enters the geofence
- Status message clears
- Delivery resumes; walker can continue marking doors

---

### 9. Skipped Address Handling

**Scenario**: Walker encounters a door they cannot access (no answer, gated property, unsafe) and skips it.

**Description**:
- Walker is within range of a door address
- Walker taps "No Answer" or "Skip Address" (not all implementations have this; verify)
- Door is marked as "skipped" or "no answer"
- Walker moves to the next door

**Success Criteria**:
- A "Skip" or "No Answer" button is present alongside the door address
- Tapping it is quick and does not require a 30-second delay
- Door is visually marked as skipped in the list (e.g., strikethrough, gray text)
- Skipped doors are still counted in the completion progress (e.g., "15 of 20 addresses marked, 5 skipped")

**Safety Criteria**:
- Skipped doors are **not** marked as "delivered" in the history
- Client can see which doors were skipped and follow up
- Walker's completion percentage reflects skipped + delivered, not just delivered

**Recovery Path**:
- If walker accidentally skips a door, they can un-skip it (if UI supports it) or the client can reassign later
- Skipped doors appear in the history report for client review

---

### 10. Failed Sync / Data Loss Recovery

**Scenario**: Walker marks several doors as delivered, but a network glitch prevents the sync from reaching the server. Walker's phone dies or they force-close the app.

**Description**:
- Walker is actively delivering and marking doors
- Network drops briefly; some marks are queued but not sent
- Walker's phone loses battery or app is force-closed
- Walker relaunches the app or network reconnects

**Success Criteria**:
- Locally marked doors are preserved in the app's local state
- On network recovery or relaunch, marked doors are synced to the server
- No doors are unmarked due to sync failure
- Walker sees a notification or status message confirming sync (e.g., "Syncing… 5 doors")

**Safety Criteria**:
- Sync is **not** one-way: server state does not overwrite local marks
- If a door was marked locally but also manually un-marked on another device, the conflict is resolved (last-write-wins or manual confirmation)
- Delivery history shows accurate timestamps (when door was actually marked, not when sync completed)

**Recovery Path**:
- Network reconnects → app automatically retries sync
- If sync fails after 3 retries, show a manual "Retry Sync" button
- If sync is stuck, walker can contact support with a sync ID or error code

---

### 11. Completing a Route and Viewing Earnings

**Scenario**: Walker finishes marking all (or most) doors as delivered, taps "Complete Delivery," and views their earnings/payment.

**Description**:
- Walker has marked doors and arrives at the last address
- Walker taps "Complete Delivery" or sees an auto-completion prompt
- Delivery state changes to "completed"
- Walker is directed to a completion confirmation screen
- Walker can navigate to `/walker/history` to see the completed delivery and earnings

**Success Criteria**:
- A completion modal or screen appears confirming the delivery is done
- Completion shows: delivery ID, suburb, doors marked, earnings amount, pay date (if applicable)
- Modal has a "View History" or "Back to Campaigns" button
- `/walker/history` lists the completed delivery with earnings and payment status
- History entries are sortable by date and show delivery duration

**Safety Criteria**:
- Completion is immutable (cannot re-open a completed delivery and add more marks)
- Earnings calculation matches the campaign settings (flat fee, per-door, bonus for 100% completion)
- Payment status is accurate (pending, processed, paid)

**Recovery Path**:
- If completion fails, show error: "Could not complete delivery. Check your connection and try again."
- If history page fails to load, show "Sync Latest" button to pull newest data
- If earnings calculation is disputed, walker can contact support with delivery ID

---

## Acceptance Checklist

### Automated Browser Tests (Playwright)
- ✅ First sign-in & role selection (login.spec.ts)
- ✅ Campaign discovery & filtering (walker-campaigns-mobile.spec.ts)
- ✅ Campaign detail & interest expression (walker-campaign-detail-mobile.spec.ts)
- ✅ Assignment state confirmation (walker-campaign-detail-mobile.spec.ts)
- ✅ Route completion & history view (walker-history.spec.ts or walker-flow.spec.ts)
- 🔄 **Geolocation permission denied** (NEW: walker-field-scenarios.spec.ts)
- 🔄 **Offline/no-network scenario** (NEW: walker-field-scenarios.spec.ts)

### Manual Device Tests (Real GPS Hardware Required)
- ⏸️ Geofence triggers auto-delivery at correct radius
- ⏸️ Walking-pace validation (rejects cycling/driving)
- ⏸️ GPS accuracy under tree cover / urban canyon
- ⏸️ Battery behavior on iOS/Android (background location service)
- ⏸️ Out-of-range detection & re-entry handling
- ⏸️ Late start within delivery window
- ⏸️ Skipped address marking (if implemented)
- ⏸️ Failed sync recovery (force-close, network failure)

---

## Test Coverage Map

| Scenario | Automated Test | Status | Test File |
|----------|---|---|---|
| First sign-in & role selection | Yes | ✅ Implemented | `login.spec.ts` |
| Geolocation permission denied | Yes | 🔄 NEW | `walker-field-scenarios.spec.ts` |
| No network / offline | Yes | 🔄 NEW | `walker-field-scenarios.spec.ts` |
| Finding & filtering campaign | Yes | ✅ Implemented | `walker-campaigns-mobile.spec.ts` |
| Expressing interest | Yes | ✅ Implemented | `walker-campaign-detail-mobile.spec.ts` |
| Assignment confirmation | Yes | ✅ Implemented | `walker-campaign-detail-mobile.spec.ts` |
| Late start / delayed delivery | Manual* | ⏸️ Device-only | See GPS Hardware Checks below |
| Out-of-range during delivery | Manual* | ⏸️ Device-only | See GPS Hardware Checks below |
| Skipped address handling | Manual* | ⏸️ Device-only | See GPS Hardware Checks below |
| Failed sync / data loss | Partial | 🔄 NEW | `walker-field-scenarios.spec.ts` (offline simulation) |
| Route completion & earnings | Yes | ✅ Implemented | `walker-flow.spec.ts` |

*These scenarios depend on real GPS coordinates, geofence boundaries, and pace validation. They cannot be fully tested in CI without a real device.

---

## GPS/Location Hardware Checks

**Setup**: These tests must be performed on a real iOS or Android device with:
- The app installed from the staging or production build
- Real GPS enabled
- A real campaign created in the test environment with a known geofence (e.g., a 50-meter radius around a parking lot)
- A real walker account assigned to the campaign

### GPS Accuracy & Geofence Triggers

**Test**:
1. Start delivery while standing at the center of the geofence
2. Walk to the geofence boundary (as calculated by the app)
3. Stand at the boundary for 10 seconds and observe:
   - Does the geofence remain "active" or does it flip to "out-of-range"?
   - Is the boundary +/- 5 meters of the configured radius?

**Success**: Geofence boundary is within ±5 meters of configured radius. No false triggers at the boundary.

### Walking-Pace Validation

**Test**:
1. Start delivery within the geofence
2. Drive a car or cycle at 15+ km/h through a door address
3. Observe whether:
   - App blocks the delivery mark (pace check rejects it)
   - App shows a message (e.g., "You're moving too fast – walk to this address")
   - App allows the mark anyway (no pace check implemented)

**Success**: App rejects delivery marks while moving faster than walking pace (~5 km/h), or clearly warns the user.

### GPS Accuracy Under Tree Cover / Urban Canyon

**Test**:
1. Start delivery under dense tree cover or between tall buildings (urban canyon)
2. Observe GPS accuracy (if shown in UI as a visual indicator)
3. Mark a door and complete delivery
4. Check server-side delivery record:
   - Are GPS coordinates recorded accurately?
   - Is the timestamp correct?
   - Does GPS accuracy degrade but still allow delivery?

**Success**: Delivery completes despite poor GPS accuracy; coordinates are recorded (may have ±10m error, which is acceptable).

### Battery & Background Location Behavior

**Test (iOS)**:
1. Start a delivery
2. Lock the device screen
3. Let the app run in the background for 2 minutes
4. Unlock the device and observe:
   - Is GPS still active (battery drain indicator visible)?
   - Can the walker still mark doors without resuming the app?
   - Does the app use `CLLocationManager.startUpdatingLocation()` with `allowsBackgroundLocationUpdates`?

**Test (Android)**:
1. Start a delivery
2. Press the home button (app goes to background)
3. Wait 2 minutes
4. Observe:
   - Does the app show a persistent notification ("DoorDrop is using your location")?
   - Can the walker still mark doors while locked?
   - Battery drain is minimal if no movement detected?

**Success**: App maintains GPS tracking in the background without excessive battery drain. Notification is clear and compliant with platform guidelines.

---

## Implementation & Maintenance Notes

- **Polling intervals**: Walker delivery page polls for door state changes every 5 seconds. Consider WebSocket (Durable Objects / `fas.rooms`) for real-time updates (issue #10).
- **Offline support**: Use IndexedDB or localStorage to cache campaign list, door marks, and user profile for offline-first UX.
- **Error boundaries**: Wrap walker pages in error boundaries to gracefully handle unrecoverable API failures.
- **A/B testing**: Once all scenarios pass, consider A/B testing the UI for skipped addresses, out-of-range warnings, and sync status indicators.
- **Accessibility**: Ensure all state transitions use `aria-live` announcements (e.g., "Assignment confirmed", "Interest withdrawn", "Delivery completed").

---

## Related Issues

- **#33**: Walker mobile UX epic (parent)
- **#10**: Replace polling with WebSocket (fas.rooms) for real-time delivery updates
- **#11**: Real-time chat & notifications via fas.rooms
- **#52**: Mobile-first walker session UI (DONE)
- **#53**: Delivery-policy enforcement (DONE)

---

*Last updated: 2026-10-09*
