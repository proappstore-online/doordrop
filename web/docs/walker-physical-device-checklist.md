# Walker Mobile UX — Physical Device Test Checklist

> **Note**: This checklist documents manual tests that require a real mobile device. These tests cannot be automated in CI/CD because they require actual device hardware (GPS, permissions, network controls).
>
> Automated browser tests cover deterministic scenarios; see `web/tests/e2e/walker-core-journeys.spec.ts` and `walker-accessibility.spec.ts` for coverage.

## Prerequisites

- Real iOS or Android device with a GPS receiver
- Ability to control network (WiFi on/off, airplane mode)
- Ability to grant/deny location permissions at OS level
- Browser: Safari (iOS) or Chrome/Firefox (Android)
- Test user account with assigned delivery campaigns
- Administrator account to create test campaigns and assign walker

---

## Test Scenarios

### 1. Location Permission: Grant Flow

**Objective**: Verify walker can start delivery when location permission is granted.

**Steps**:
1. Clear all app data / sign out from the browser
2. Sign in as walker
3. Navigate to an assigned campaign
4. Tap "Start Delivery" button
5. **System requests location permission** — tap "Allow While Using App"
6. **Expected**: 
   - Permission is granted
   - Delivery session starts
   - GPS indicator shows "Excellent" or "Good" accuracy (if outdoors)
   - Live tracking begins (geolence markers appear on map, if applicable)

**Notes**:
- Test on both iOS (Settings > Privacy > Location) and Android (Settings > Apps > Permissions)
- If app crashes or shows white screen after permission grant, note as regression
- GPS accuracy may take 10-30 seconds to stabilize outdoors

---

### 2. Location Permission: Deny Flow

**Objective**: Verify walker sees clear error and recovery path when location denied.

**Steps**:
1. Clear app data / sign out
2. Sign in as walker
3. Go to assigned campaign
4. Tap "Start Delivery"
5. **System requests location permission** — tap "Don't Allow"
6. **Expected**:
   - Error screen appears (from `WalkerSessionEndScreen` or `DeliveryStartupScreen`)
   - Message: "Location permission needed" or similar (from #59)
   - Action: "Retry" button is visible and clickable
   - Tapping "Retry" asks for permission again (doesn't crash or go to blank page)
   - Walker can exit gracefully (tap back, go to campaigns list)

**Notes**:
- Denying permission should NOT crash the app
- Denying should NOT show a "failed delivery" marker
- Retrying should re-ask for permission (not skip to error indefinitely)

---

### 3. GPS Failure: No Signal

**Objective**: Verify walker gets guidance when GPS fails or is unavailable.

**Steps**:
1. Sign in as walker with an assigned campaign
2. Go to campaign delivery start screen
3. **Disable GPS**: Go to indoor location or use simulator with "None" location
4. Tap "Start Delivery"
5. **Expected**:
   - If GPS fails to acquire in ~15 seconds:
     - Error state: "GPS signal weak" or "Location unavailable"
     - Message: "Move to an open area away from buildings" (from #59)
     - Status shows as "Checking" or "Inaccurate" (not "Ready")
   - Walker is NOT marked as in active delivery
   - Tapping "Retry" re-attempts GPS (doesn't loop forever)

**Notes**:
- Indoor locations may fail GPS acquisition (expected)
- Simulator mode: set location to "None" to test no-GPS scenario
- Weak signal should not auto-start delivery (accuracy > 50m blocks start, from #59)

---

### 4. Network Failure: Offline Start

**Objective**: Verify offline behavior during delivery startup.

**Steps**:
1. Sign in as walker (while online)
2. Go to assigned campaign
3. **Enable Airplane Mode** (or disable WiFi + cellular)
4. Tap "Start Delivery"
5. **Expected**:
   - If offline before session creation:
     - Error: "No internet connection"
     - Message: "Please connect to WiFi or mobile data, then tap Retry"
     - Status shows as "Offline" (from #59)
   - Tapping "Retry" after regaining connectivity (disable airplane mode) should allow session creation
   - Delivery does NOT start while offline

**Notes**:
- Session creation requires server communication (cannot be offline)
- If device goes offline *after* session creation, tracking should pause and resume on reconnect
- Sync state in end screen should show "partial" or "syncing" if disconnected mid-delivery

---

### 5. Network Failure: Mid-Delivery Sync Loss

**Objective**: Verify walker can continue delivery when internet is lost mid-run, with clear sync state.

**Steps**:
1. Start delivery (online, GPS active)
2. Walk to a door and manually mark as "Delivered"
3. **Enable Airplane Mode** (go offline)
4. Mark another door as "Delivered" (offline)
5. See sync status or warning appear
6. Walk to third door, mark delivered (offline)
7. **Disable Airplane Mode** (regain connectivity)
8. **Expected**:
   - Offline deliveries are saved locally (not lost)
   - When online, sync begins automatically or shows "Syncing" state
   - End-of-run screen shows sync status (from #61):
     - "⏳ Syncing deliveries..." (if still uploading)
     - "⚠ X doors pending sync" (if some failed)
     - "✓ All deliveries synced" (once complete)
   - No deliveries marked as "failed" or lost

**Notes**:
- Local storage is critical here; test that doors offline remain after refresh
- End screen should NOT show "complete" if sync is still pending
- Sync retry should be available if sync failed

---

### 6. GPS Geofence Trigger (Optional, Advanced)

**Objective**: Verify walker is near door when delivery auto-marks (if auto-delivery enabled).

**Steps**:
1. Start delivery with auto-delivery enabled
2. Walk to a nearby door (within geofence, typically 5-10m away)
3. Walk at normal pace (3-6 km/h, not running)
4. **Expected**:
   - Door automatically marked as "Delivered" when walker nears it
   - Door does NOT mark if walker is stopped (stationary)
   - Door does NOT mark if walker moving too fast (running, car)
   - Next-door guidance updates (from #60)

**Notes**:
- This requires real GPS and real walking
- Geofence accuracy depends on GPS (50m+ error margin possible)
- Pace validation: if speed > 2.5 m/s, delivery should not auto-mark
- Test both fast walk and jog to confirm speed check works

---

### 7. Battery & Background Behavior

**Objective**: Verify app doesn't drain battery excessively or crash when backgrounded.

**Steps**:
1. Start active delivery
2. Check battery usage (Settings > Battery)
3. Let app run in foreground for 2 minutes, tracking actively
4. **Background the app** (tap home / go to another app)
5. Wait 30 seconds (app is backgrounded)
6. **Return to app** (tap app icon)
7. **Expected**:
   - App resumes without crash
   - Tracking state is preserved (still shows as "active")
   - Battery impact is reasonable (not draining more than 10% per 5 min)
   - Tracking data is not lost

**Notes**:
- iOS: App may be suspended after short time in background
- Android: App may be killed if memory is low
- Use wake-lock / keep-awake to maintain tracking (from `pwaHelpers`)
- If backgrounding loses session, must resume gracefully (session recovery from #40)

---

### 8. Location Permission Revoke Mid-Delivery

**Objective**: Verify app handles permission revoked during active session.

**Steps**:
1. Start active delivery (GPS working, tracking)
2. Go to Settings > Privacy > Location
3. **Revoke location permission** for DoorDrop app
4. Return to app
5. **Expected**:
   - Error state appears: "GPS signal lost"
   - Tracking pauses (no new GPS points recorded)
   - Message: "Move to an open area..." or "Enable location..."
   - Tapping "Retry" re-requests permission
   - Session does not crash

**Notes**:
- iOS: Settings > Privacy > Location > [app name] toggle off
- Android: Settings > Apps > [app name] > Permissions > Location toggle off
- App must not crash on permission revoke
- Graceful degradation: tracking pauses, then resumes when permission restored

---

### 9. Network Degradation: Slow Connection

**Objective**: Verify app handles slow network (2G, 3G) gracefully.

**Steps**:
1. Start active delivery
2. **Reduce network to slow speed**:
   - iOS: Settings > Developer > Network Link Conditioner (2G / 3G)
   - Android: Developer Options > Network throttling
3. Continue delivery, mark doors as delivered
4. **Expected**:
   - Deliveries still sync (just slower)
   - UI doesn't freeze or timeout prematurely
   - Timeouts are generous (5+ seconds)
   - Clear message if sync is slow: "Uploading..." or "Syncing..."

**Notes**:
- Slow network should not prevent delivery marking
- Retry logic should trigger if upload timeouts
- End screen should show sync status accurately

---

### 10. Orientation: Portrait ↔ Landscape

**Objective**: Verify walker UI adapts to portrait/landscape without data loss.

**Steps**:
1. Start delivery in portrait mode
2. Mark a door as delivered
3. **Rotate device to landscape**
4. **Expected**:
   - Layout adapts (no horizontal scroll)
   - Marked door still shows as delivered
   - Tracking continues
   - Session is not interrupted

5. Rotate back to portrait
6. **Expected**:
   - Layout reverts
   - No data loss
   - Session still active

**Notes**:
- Lock rotation in OS if needed (or test with forced landscape)
- Map-based screens (if present) should adapt to orientation
- No session restart on rotation

---

## Regression Indicators

If any of the following occur during testing, file a bug:

- ❌ App crashes on permission grant/deny
- ❌ Delivery marked "complete" when sync is still pending
- ❌ Offline deliveries are lost after refresh
- ❌ Permission revoke crashes the app
- ❌ Battery drains excessively (>50% per 30 min)
- ❌ Session lost on backgrounding
- ❌ Geofence triggers when walker is stopped (false positive)
- ❌ "Synced" status shown before upload actually completes
- ❌ Retry buttons don't work or loop infinitely
- ❌ UI is unreadable in landscape or dark mode

---

## Passing Criteria

A walker UX build passes physical device testing if:

1. ✅ Permission grant/deny flows work without crashes
2. ✅ GPS failures show clear guidance (no silent failures)
3. ✅ Offline deliveries are saved and synced on reconnect
4. ✅ Sync state is clearly communicated (syncing / synced / failed)
5. ✅ Network failures don't cause data loss
6. ✅ App resumes correctly after backgrounding
7. ✅ Orientation changes don't interrupt session
8. ✅ No battery drain (< 20% per hour)
9. ✅ All errors have recovery paths (Retry, go back, etc.)
10. ✅ No crashes or silent failures

---

## Notes for Test Engineers

- **Schedule**: Run before each production release
- **Device coverage**: Test on 1 iOS + 1 Android device at minimum
- **Network**: Use airplane mode, WiFi toggle, network throttling
- **GPS**: Test indoors (no signal) and outdoors (good signal)
- **Duration**: Each scenario ~5-10 minutes; full checklist ~90 minutes
- **Documentation**: Screenshot/video permission grant and any errors for bug reports

---

## References

- Automated tests: `web/tests/e2e/walker-core-journeys.spec.ts`
- Accessibility tests: `web/tests/e2e/walker-accessibility.spec.ts`
- Permission/startup UX: Issue #59 (`DeliveryStartupScreen`)
- In-route guidance: Issue #60 (`WalkerSessionInProgress`)
- End-of-run: Issue #61 (`WalkerSessionEndScreen`)
- Tracking integrity: Issue #40
- Delivery policy: Issue #42
