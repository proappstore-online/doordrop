// doordrop's access rules, through the worker AND straight at the actions (a
// signed-in user can call a registered action without the worker), so a rule
// that only the worker enforced would show up here.
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import worker from '../src/index.js';
import { fakePas, freshDb } from './fake-pas.js';

const ADMIN = 'gh:1';
const CLIENT_1 = 'gh:11';
const CLIENT_2 = 'gh:12';
const WALKER_1 = 'gh:21';
const WALKER_2 = 'gh:22';

let db: DatabaseSync;

async function req(user: string, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await app.fetch(new Request(`https://doordrop.proappstore.online${path}`, init), { pas: fakePas(db, user) });
  return { status: res.status, body: (await res.json()) as any };
}

/** A registered action called directly, as a signed-in user's browser could. */
function direct(user: string, name: string, params: Record<string, unknown> = {}) {
  return fakePas(db, user).actions.call(name, params) as Promise<any>;
}

const row = (sql: string, ...params: (string | number)[]) => db.prepare(sql).get(...params) as any;

let campaignId: string;
let doorId: string;

beforeEach(async () => {
  db = freshDb();
  for (const [id, role] of [[ADMIN, 'client'], [CLIENT_1, 'client'], [CLIENT_2, 'client'], [WALKER_1, 'walker'], [WALKER_2, 'walker']]) {
    expect((await req(id!, 'POST', '/v1/me/role', { role, name: id })).status).toBe(200);
  }
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(ADMIN);

  const created = await req(CLIENT_1, 'POST', '/v1/campaigns', { name: 'Elm St drop' });
  expect(created.status).toBe(201);
  campaignId = created.body.id;
  expect((await req(CLIENT_1, 'PATCH', `/v1/campaigns/${campaignId}`, { assigned_walker_id: WALKER_1, status: 'assigned' })).status).toBe(200);
  const door = await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/doors`, { address: '1 Elm St' });
  expect(door.status).toBe(201);
  doorId = door.body.id;
});

describe('/v1/me', () => {
  it('asks a new user to pick a role, once, and never admin', async () => {
    const fresh = 'gh:99';
    expect((await req(fresh, 'GET', '/v1/me')).body).toEqual({ user: { id: fresh, login: fresh }, needsRoleSelection: true });
    expect((await req(fresh, 'POST', '/v1/me/role', { role: 'admin' })).status).toBe(400);
    expect((await direct(fresh, 'create_me', { role: 'admin' })).meta.changes).toBe(0);
    expect((await req(fresh, 'POST', '/v1/me/role', { role: 'walker' })).status).toBe(200);
    expect((await req(fresh, 'POST', '/v1/me/role', { role: 'client' })).status).toBe(409);
    const me = await req(fresh, 'GET', '/v1/me');
    expect(me.body.needsRoleSelection).toBe(false);
    expect(me.body.user.role).toBe('walker');
  });
});

describe('a client cannot edit another client\'s campaign', () => {
  it('through the worker', async () => {
    expect((await req(CLIENT_2, 'PATCH', `/v1/campaigns/${campaignId}`, { name: 'mine now' })).status).toBe(403);
    expect((await req(CLIENT_2, 'DELETE', `/v1/campaigns/${campaignId}`)).status).toBe(403);
    expect((await req(CLIENT_2, 'POST', `/v1/campaigns/${campaignId}/doors`, { address: '2 Elm St' })).status).toBe(403);
    expect((await req(CLIENT_2, 'PATCH', '/v1/campaigns/nope', { name: 'x' })).status).toBe(404);
    expect(row('SELECT name FROM campaigns WHERE id = ?', campaignId).name).toBe('Elm St drop');
  });

  it('straight at the actions', async () => {
    const patch = JSON.stringify({ name: 'mine now', admin_ids: [CLIENT_2] });
    expect((await direct(CLIENT_2, 'update_campaign', { id: campaignId, patch })).meta.changes).toBe(0);
    await direct(CLIENT_2, 'delete_campaign', { id: campaignId });
    expect(row('SELECT COUNT(*) AS n FROM campaigns WHERE id = ?', campaignId).n).toBe(1);
    expect((await direct(CLIENT_2, 'create_door', { id: 'd2', campaign_id: campaignId, address: '2 Elm St' })).meta.changes).toBe(0);
    expect((await direct(CLIENT_2, 'notify_walker_assigned', { campaign_id: campaignId, walker_id: WALKER_1 })).meta.changes).toBe(0);
    // A campaign the caller is not an admin of cannot be created either.
    expect((await direct(CLIENT_2, 'create_campaign', { id: 'c2', name: 'x', admin_ids: JSON.stringify([CLIENT_1]) })).meta.changes).toBe(0);
    expect(row('SELECT name, admin_ids FROM campaigns WHERE id = ?', campaignId)).toEqual({ name: 'Elm St drop', admin_ids: JSON.stringify([CLIENT_1]) });
  });

  it('lets the campaign admin edit it, and notifies a newly assigned walker in the same transaction', async () => {
    expect((await req(CLIENT_1, 'PATCH', `/v1/campaigns/${campaignId}`, { admin_ids: 'x' })).status).toBe(400);
    expect((await req(CLIENT_1, 'PATCH', `/v1/campaigns/${campaignId}`, { status: 'bogus' })).status).toBe(400);
    expect((await req(CLIENT_1, 'PATCH', `/v1/campaigns/${campaignId}`, { assigned_walker_id: WALKER_2, budget: 50 })).status).toBe(200);
    // Verify edit succeeded: only campaign admin can read full details (non-participants get 403)
    expect((await req(CLIENT_2, 'GET', `/v1/campaigns/${campaignId}`)).status).toBe(403);
    const campaign = (await req(CLIENT_1, 'GET', `/v1/campaigns/${campaignId}`)).body;
    expect(campaign).toMatchObject({ assigned_walker_id: WALKER_2, budget: 50, admin_ids: [CLIENT_1], member_ids: [] });
    const notes = (await req(WALKER_2, 'GET', '/v1/notifications')).body;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: 'walker_assigned', campaign_id: campaignId, body: "You're delivering for Elm St drop" });
  });
});

describe('deleting a campaign (the schema has no ON DELETE CASCADE)', () => {
  const count = (table: string) => row(`SELECT COUNT(*) AS n FROM ${table}`).n;
  const CHILDREN = ['doors', 'printouts', 'delivery_runs', 'track_sessions', 'track_points', 'track_stops', 'walker_interests', 'campaign_notes', 'bookings'];
  const booking = (id: string, campaign: string) =>
    `INSERT INTO bookings (id, campaign_id, walker_id, client_id, date, door_count, rate_per_door, total_price, price_per_member, member_count, created_at)
       VALUES ('${id}', '${campaign}', '${WALKER_1}', '${CLIENT_1}', 1, 1, 1, 1, 1, 1, 1);`;

  function seedChildren() {
    db.exec(`
      INSERT INTO printouts (id, campaign_id, version, name, created_at, created_by) VALUES ('p1', '${campaignId}', 1, 'flyer', 1, '${CLIENT_1}');
      INSERT INTO delivery_runs (id, campaign_id, walker_id, status, date, created_at) VALUES ('r1', '${campaignId}', '${WALKER_1}', 'scheduled', 1, 1);
      INSERT INTO track_sessions (id, campaign_id, walker_id, started_at) VALUES ('s1', '${campaignId}', '${WALKER_1}', 1);
      INSERT INTO track_points (session_id, t, lat, lng) VALUES ('s1', 1, 1, 2);
      INSERT INTO track_stops (id, session_id, lat, lng, start_time, end_time) VALUES ('st1', 's1', 1, 2, 1, 2);
      INSERT INTO walker_interests (id, walker_id, campaign_id, created_at) VALUES ('i1', '${WALKER_2}', '${campaignId}', 1);
      INSERT INTO campaign_notes (id, campaign_id, user_id, user_name, text, created_at) VALUES ('n1', '${campaignId}', '${CLIENT_1}', 'C1', 'hi', 1);
      ${booking('b1', campaignId)}
      INSERT INTO campaigns (id, name, status, admin_ids, created_at) VALUES ('other', 'Other', 'draft', '["${CLIENT_1}"]', 1);
      INSERT INTO doors (id, campaign_id, address, status) VALUES ('od', 'other', '9 Oak St', 'pending');
      ${booking('ob', 'other')}
    `);
  }

  it('is refused for a non-admin, through the worker and at the action', async () => {
    seedChildren();
    const before = Object.fromEntries(CHILDREN.map((t) => [t, count(t)]));
    expect((await req(CLIENT_2, 'DELETE', `/v1/campaigns/${campaignId}`)).status).toBe(403);
    await direct(CLIENT_2, 'delete_campaign', { id: campaignId });
    await direct(WALKER_1, 'delete_campaign', { id: campaignId });
    expect(row('SELECT COUNT(*) AS n FROM campaigns WHERE id = ?', campaignId).n).toBe(1);
    expect(Object.fromEntries(CHILDREN.map((t) => [t, count(t)]))).toEqual(before);
  });

  it('removes the campaign and all its children for the campaign admin, through the worker', async () => {
    seedChildren();
    expect((await req(CLIENT_1, 'DELETE', `/v1/campaigns/${campaignId}`)).status).toBe(200);
    expect(row('SELECT COUNT(*) AS n FROM campaigns WHERE id = ?', campaignId).n).toBe(0);
    // Only the other campaign's door and booking remain.
    for (const t of CHILDREN) expect(count(t), t).toBe(t === 'doors' || t === 'bookings' ? 1 : 0);
    expect(row("SELECT COUNT(*) AS n FROM campaigns WHERE id = 'other'").n).toBe(1);
  });

  it('removes them straight at the action too', async () => {
    seedChildren();
    await direct(CLIENT_1, 'delete_campaign', { id: campaignId });
    expect(row('SELECT COUNT(*) AS n FROM campaigns WHERE id = ?', campaignId).n).toBe(0);
    for (const t of CHILDREN) expect(count(t), t).toBe(t === 'doors' || t === 'bookings' ? 1 : 0);
  });
});

describe('a walker cannot see or act on another walker\'s assignment', () => {
  it('notes, tracking and doors are the assigned walker\'s and the campaign admin\'s only', async () => {
    expect((await req(WALKER_1, 'POST', `/v1/campaigns/${campaignId}/notes`, { text: 'gate code 42', userName: 'W1' })).status).toBe(201);
    expect((await req(WALKER_1, 'GET', `/v1/campaigns/${campaignId}/notes`)).body).toHaveLength(1);
    expect((await req(CLIENT_1, 'GET', `/v1/campaigns/${campaignId}/notes`)).body).toHaveLength(1);

    expect((await req(WALKER_2, 'GET', `/v1/campaigns/${campaignId}/notes`)).status).toBe(403);
    expect((await req(WALKER_2, 'POST', `/v1/campaigns/${campaignId}/notes`, { text: 'hi', userName: 'W2' })).status).toBe(403);
    expect((await req(WALKER_2, 'GET', `/v1/campaigns/${campaignId}/track-sessions`)).status).toBe(403);
    expect((await req(WALKER_2, 'POST', `/v1/campaigns/${campaignId}/track-sessions`)).status).toBe(403);
    expect((await req(WALKER_2, 'PATCH', `/v1/campaigns/${campaignId}/doors/${doorId}`, { status: 'delivered' })).status).toBe(403);

    expect((await direct(WALKER_2, 'list_campaign_notes', { campaign_id: campaignId })).rows).toEqual([]);
    expect((await direct(WALKER_2, 'create_campaign_note', { id: 'n2', campaign_id: campaignId, user_name: 'W2', text: 'hi', created_at: 1 })).meta.changes).toBe(0);
    expect((await direct(WALKER_2, 'start_track_session', { id: 's2', campaign_id: campaignId })).meta.changes).toBe(0);
    expect((await direct(WALKER_2, 'update_door_as_walker', { id: doorId, campaign_id: campaignId, patch: '{"status":"delivered"}' })).meta.changes).toBe(0);
    expect(row('SELECT status FROM doors WHERE id = ?', doorId).status).toBe('pending');
  });

  it('a tracking session is its walker\'s to write and its campaign admin\'s to read', async () => {
    const session = await req(WALKER_1, 'POST', `/v1/campaigns/${campaignId}/track-sessions`);
    expect(session.status).toBe(201);
    const sid = session.body.id;
    const append = { points: [{ t: 1, lat: 1, lng: 2 }, { t: 2, lat: 1.1, lng: 2.1, speed: 3 }], stops: [{ lat: 1, lng: 2, startTime: 1, endTime: 2 }] };
    expect((await req(WALKER_1, 'POST', `/v1/track-sessions/${sid}/append`, append)).body).toEqual({ ok: true, points: 2, stops: 1 });

    expect((await req(WALKER_2, 'POST', `/v1/track-sessions/${sid}/append`, append)).status).toBe(403);
    expect((await req(WALKER_2, 'PATCH', `/v1/track-sessions/${sid}`, { ended_at: 5 })).status).toBe(403);
    expect((await direct(WALKER_2, 'append_track_point', { session_id: sid, t: 9, lat: 0, lng: 0 })).meta.changes).toBe(0);
    expect((await direct(WALKER_2, 'end_track_session', { id: sid, ended_at: 5 })).meta.changes).toBe(0);

    expect((await req(WALKER_2, 'GET', `/v1/track-sessions/${sid}`)).status).toBe(403);
    expect((await req(CLIENT_2, 'GET', `/v1/track-sessions/${sid}`)).status).toBe(403);
    expect((await direct(WALKER_2, 'list_track_points', { session_id: sid })).rows).toEqual([]);
    expect((await req(WALKER_2, 'GET', '/v1/track-sessions/nope')).status).toBe(404);

    const seen = await req(CLIENT_1, 'GET', `/v1/track-sessions/${sid}`);
    expect(seen.status).toBe(200);
    expect(seen.body.points).toHaveLength(2);
    expect(seen.body.stops).toEqual([{ lat: 1, lng: 2, startTime: 1, endTime: 2 }]);
    expect((await req(ADMIN, 'GET', `/v1/campaigns/${campaignId}/track-sessions`)).body).toHaveLength(1);
  });
});

describe('door field allow-lists', () => {
  it('the assigned walker records deliveries only, as themselves', async () => {
    const res = await req(WALKER_1, 'PATCH', `/v1/campaigns/${campaignId}/doors/${doorId}`, {
      status: 'delivered', delivered_by: WALKER_1, delivered_at: 5, address: 'rewritten', history: [{ at: 5 }],
    });
    expect(res.status).toBe(200);
    expect(row('SELECT status, delivered_by, address, history FROM doors WHERE id = ?', doorId)).toEqual({
      status: 'delivered', delivered_by: WALKER_1, address: '1 Elm St', history: '[{"at":5}]',
    });
    expect((await req(WALKER_1, 'PATCH', `/v1/campaigns/${campaignId}/doors/${doorId}`, { delivered_by: WALKER_2 })).status).toBe(403);
    expect((await req(WALKER_1, 'PATCH', `/v1/campaigns/${campaignId}/doors/${doorId}`, { status: 'lost' })).status).toBe(400);
    // Straight at the action: someone else's name, or a column off the walker list, changes nothing.
    expect((await direct(WALKER_1, 'update_door_as_walker', { id: doorId, campaign_id: campaignId, patch: JSON.stringify({ delivered_by: WALKER_2 }) })).meta.changes).toBe(0);
    await direct(WALKER_1, 'update_door_as_walker', { id: doorId, campaign_id: campaignId, patch: JSON.stringify({ address: 'x', lat: 9 }) });
    expect(row('SELECT address, lat, delivered_by FROM doors WHERE id = ?', doorId)).toEqual({ address: '1 Elm St', lat: null, delivered_by: WALKER_1 });
    expect((await direct(WALKER_1, 'update_door_as_admin', { id: doorId, campaign_id: campaignId, patch: '{"address":"x"}' })).meta.changes).toBe(0);
  });

  it('the campaign admin edits any door field and bulk-adds doors', async () => {
    expect((await req(CLIENT_1, 'PATCH', `/v1/campaigns/${campaignId}/doors/${doorId}`, { address: '1A Elm St', delivered_by: WALKER_2 })).status).toBe(200);
    expect(row('SELECT address, delivered_by FROM doors WHERE id = ?', doorId)).toEqual({ address: '1A Elm St', delivered_by: WALKER_2 });
    const bulk = await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/doors/bulk`, { doors: [{ address: '3 Elm St' }, { address: '5 Elm St', status: 'reported' }] });
    expect(bulk).toEqual({ status: 201, body: { ok: true, count: 2 } });
    expect((await req(WALKER_1, 'GET', `/v1/campaigns/${campaignId}/doors`)).body.map((d: any) => d.history)).toEqual([[], [], []]);
  });
});

describe('app admin, self-only and owner-only rules', () => {
  it('only an app admin manages users, history and config', async () => {
    expect((await req(CLIENT_1, 'DELETE', `/v1/users/${WALKER_2}`)).status).toBe(403);
    expect((await req(CLIENT_1, 'POST', `/v1/admin/users/${CLIENT_1}/role`, { role: 'admin' })).status).toBe(403);
    expect((await req(CLIENT_1, 'PUT', '/v1/config/platform', { default_payment_mode: 'direct' })).status).toBe(403);
    expect((await direct(CLIENT_1, 'admin_set_user_role', { id: CLIENT_1, role: 'admin' })).meta.changes).toBe(0);
    expect((await direct(CLIENT_1, 'admin_delete_user', { id: WALKER_2 })).meta.changes).toBe(0);
    expect((await direct(CLIENT_1, 'set_platform_config', { default_payment_mode: 'direct' })).meta.changes).toBe(0);

    expect((await req(ADMIN, 'PUT', '/v1/config/platform', { default_payment_mode: 'direct' })).status).toBe(200);
    expect((await req(CLIENT_1, 'GET', '/v1/config/platform')).body).toEqual({ default_payment_mode: 'direct' });
    expect((await req(ADMIN, 'POST', `/v1/admin/users/${ADMIN}/role`, { role: 'client' })).status).toBe(409);
    expect((await direct(ADMIN, 'admin_set_user_role', { id: ADMIN, role: 'client' })).meta.changes).toBe(0);
    expect((await req(ADMIN, 'POST', `/v1/admin/users/${CLIENT_2}/role`, { role: 'walker' })).status).toBe(200);
    expect((await req(ADMIN, 'POST', '/v1/admin/users/gh:404/role', { role: 'walker' })).status).toBe(404);
    expect((await req(ADMIN, 'DELETE', `/v1/users/${WALKER_2}`)).body).toEqual({ ok: true, changed: 1 });
  });

  it('a user edits only their own profile; payment_mode is set once', async () => {
    expect((await req(CLIENT_2, 'PATCH', `/v1/users/${CLIENT_1}`, { name: 'x' })).status).toBe(403);
    expect((await direct(CLIENT_2, 'admin_update_user', { id: CLIENT_1, patch: '{"name":"x"}' })).meta.changes).toBe(0);
    expect((await req(CLIENT_1, 'PATCH', `/v1/users/${CLIENT_1}`, { payment_mode: 'card' })).status).toBe(400);
    expect((await req(CLIENT_1, 'PATCH', `/v1/users/${CLIENT_1}`, { payment_mode: 'direct', role: 'admin', client_profile: { a: 1 } })).body).toEqual({ ok: true, changed: 1 });
    await req(CLIENT_1, 'PATCH', `/v1/users/${CLIENT_1}`, { payment_mode: 'platform' });
    await direct(CLIENT_1, 'update_my_user', { patch: '{"payment_mode":"platform","role":"admin"}' });
    expect(row('SELECT payment_mode, role, client_profile FROM users WHERE id = ?', CLIENT_1)).toEqual({ payment_mode: 'direct', role: 'client', client_profile: '{"a":1}' });
    expect((await req(ADMIN, 'PATCH', `/v1/users/${CLIENT_1}`, { payment_mode: 'platform' })).status).toBe(200);
    expect(row('SELECT payment_mode FROM users WHERE id = ?', CLIENT_1).payment_mode).toBe('platform');
  });

  it('any user can fetch any user profile', async () => {
    const res = await req(CLIENT_2, 'GET', `/v1/users/${CLIENT_1}`);
    expect(res.status).toBe(200);
    // API returns snake_case keys (created_at, photo_url, etc), which frontend converts via fromWire()
    expect(res.body).toMatchObject({ id: CLIENT_1, name: CLIENT_1, role: 'client' });
    expect(res.body).toHaveProperty('created_at');

    // Non-existent user returns 404
    expect((await req(CLIENT_1, 'GET', '/v1/users/nope')).status).toBe(404);

    // Action directly returns the raw row with all columns
    const directResult = await direct(WALKER_1, 'get_user', { id: CLIENT_1 });
    expect(directResult).toHaveProperty('rows');
    expect(directResult.rows?.[0]).toMatchObject({ id: CLIENT_1, name: CLIENT_1 });
  });

  it('walker stats, flyers and chat read state are self-only', async () => {
    expect((await req(WALKER_2, 'POST', `/v1/users/${WALKER_1}/walker-stats/increment`, { doorsDelivered: 3 })).status).toBe(403);
    expect((await req(WALKER_1, 'POST', `/v1/users/${WALKER_1}/walker-stats/increment`, { doorsDelivered: 3 })).body.profile).toEqual({ totalDoorsDelivered: 3 });
    expect((await req(WALKER_1, 'POST', `/v1/users/${WALKER_1}/walker-stats/increment`, { doorsDelivered: 2 })).body.profile).toEqual({ totalDoorsDelivered: 5 });

    const flyer = await req(CLIENT_1, 'POST', `/v1/users/${CLIENT_1}/flyers`, { name: 'A5' });
    expect(flyer.status).toBe(201);
    expect((await req(CLIENT_2, 'GET', `/v1/users/${CLIENT_1}/flyers`)).status).toBe(403);
    expect((await req(CLIENT_2, 'DELETE', `/v1/users/${CLIENT_1}/flyers/${flyer.body.id}`)).status).toBe(403);
    expect((await direct(CLIENT_2, 'delete_flyer', { id: flyer.body.id })).meta.changes).toBe(0);
    expect((await direct(CLIENT_2, 'list_my_flyers')).rows).toEqual([]);
    expect((await req(CLIENT_1, 'GET', `/v1/users/${CLIENT_1}/flyers`)).body).toHaveLength(1);

    expect((await req(CLIENT_2, 'PUT', `/v1/users/${CLIENT_1}/chat-read-state/${campaignId}`)).status).toBe(403);
    expect((await req(CLIENT_1, 'PUT', `/v1/users/${CLIENT_1}/chat-read-state/${campaignId}`)).status).toBe(200);
    expect(Object.keys((await req(CLIENT_1, 'GET', `/v1/users/${CLIENT_1}/chat-read-state`)).body)).toEqual([campaignId]);
  });

  it('interests, reviews and notifications belong to their author', async () => {
    const interest = await req(WALKER_2, 'POST', '/v1/interests', { campaignId });
    expect(interest.status).toBe(201);
    expect((await req(WALKER_2, 'POST', '/v1/interests', { campaignId })).status).toBe(409);
    expect((await req(WALKER_2, 'POST', '/v1/interests', { campaignId: 'nope' })).status).toBe(404);
    const adminNotes = (await req(CLIENT_1, 'GET', '/v1/notifications?unread=true')).body;
    expect(adminNotes).toHaveLength(1);
    expect(adminNotes[0]).toMatchObject({ type: 'walker_interested', body: `${WALKER_2} wants to deliver for Elm St drop` });
    // A duplicate interest does not notify again.
    expect(row('SELECT count(*) AS n FROM notifications WHERE type = ?', 'walker_interested').n).toBe(1);

    expect((await req(WALKER_1, 'DELETE', `/v1/interests/${interest.body.id}`)).status).toBe(403);
    expect((await direct(WALKER_1, 'delete_my_interest', { id: interest.body.id })).meta.changes).toBe(0);
    expect((await req(WALKER_1, 'DELETE', '/v1/interests/nope')).status).toBe(404);

    expect((await req(WALKER_1, 'PATCH', `/v1/notifications/${adminNotes[0].id}`, { read: true })).status).toBe(403);
    expect((await direct(WALKER_1, 'set_notification_read', { id: adminNotes[0].id, read: 1 })).meta.changes).toBe(0);
    expect((await req(CLIENT_1, 'PATCH', `/v1/notifications/${adminNotes[0].id}`, { read: true })).status).toBe(200);
    expect((await req(CLIENT_1, 'GET', '/v1/notifications?unread=true')).body).toEqual([]);

    expect((await req(CLIENT_1, 'POST', `/v1/walkers/${WALKER_1}/reviews`, { rating: 6 })).status).toBe(400);
    const review = await req(CLIENT_1, 'POST', `/v1/walkers/${WALKER_1}/reviews`, { rating: 4, comment: 'on time' });
    expect(review.status).toBe(201);
    expect((await direct(CLIENT_1, 'create_review', { id: 'r2', walker_id: WALKER_1, rating: 9 })).meta.changes).toBe(0);
    expect((await req(CLIENT_2, 'PATCH', `/v1/reviews/${review.body.id}`, { rating: 1 })).status).toBe(403);
    expect((await direct(CLIENT_2, 'update_my_review', { id: review.body.id, rating: 1 })).meta.changes).toBe(0);
    expect((await req(CLIENT_1, 'PATCH', `/v1/reviews/${review.body.id}`, { rating: 5 })).status).toBe(200);
    expect((await req(WALKER_2, 'GET', `/v1/walkers/${WALKER_1}/reviews`)).body[0]).toMatchObject({ rating: 5, comment: 'on time', reviewer_id: CLIENT_1 });
  });
});

describe('properties', () => {
  it('are visible to the users on access_user_ids, which can grow but never shrink', async () => {
    const created = await req(CLIENT_1, 'POST', '/v1/properties', { address: '1 Elm St', suburb: 'Elm', postcode: '2000', commercial: true });
    expect(created).toEqual({ status: 201, body: { id: '1_elm_st|elm|2000' } });
    const id = encodeURIComponent(created.body.id);

    expect((await req(CLIENT_2, 'GET', `/v1/properties/${id}`)).status).toBe(403);
    expect((await req(CLIENT_2, 'GET', '/v1/properties/nope')).status).toBe(404);
    expect((await req(CLIENT_2, 'GET', `/v1/properties?userId=${CLIENT_1}`)).status).toBe(403);
    expect((await req(CLIENT_2, 'POST', `/v1/properties/${id}/reports`, { reason: 'other' })).status).toBe(403);
    expect((await direct(CLIENT_2, 'create_property_report', { id: 'pr', property_id: created.body.id, reason: 'other' })).meta.changes).toBe(0);
    expect((await direct(CLIENT_2, 'update_property', { id: created.body.id, patch: '{"address":"x"}' })).meta.changes).toBe(0);

    expect((await req(CLIENT_1, 'GET', `/v1/properties/${id}`)).body).toMatchObject({ commercial: 1, access_user_ids: [CLIENT_1] });
    expect((await req(CLIENT_1, 'PATCH', `/v1/properties/${id}`, { access_user_ids: [WALKER_1] })).status).toBe(403);
    expect((await direct(CLIENT_1, 'update_property', { id: created.body.id, patch: JSON.stringify({ access_user_ids: [WALKER_1] }) })).meta.changes).toBe(0);
    expect((await req(CLIENT_1, 'PATCH', `/v1/properties/${id}`, { access_user_ids: [CLIENT_1, WALKER_1], commercial: false })).status).toBe(200);
    expect((await req(WALKER_1, 'GET', '/v1/properties')).body.map((p: any) => [p.id, p.commercial])).toEqual([[created.body.id, 0]]);
    expect((await req(WALKER_1, 'POST', `/v1/properties/${id}/reports`, { reason: 'angry_owner' })).status).toBe(201);
    expect((await req(CLIENT_1, 'GET', `/v1/properties/${id}/reports`)).body).toHaveLength(1);
  });

  it('known loose rule, kept by the faithful port: posting a known address joins its access list', async () => {
    await req(CLIENT_1, 'POST', '/v1/properties', { address: '1 Elm St', suburb: 'Elm', postcode: '2000' });
    await req(CLIENT_2, 'POST', '/v1/properties', { address: '1 Elm St', suburb: 'Elm', postcode: '2000' });
    await req(CLIENT_2, 'POST', '/v1/properties', { address: '1 Elm St', suburb: 'Elm', postcode: '2000' });
    expect(JSON.parse(row('SELECT access_user_ids FROM properties').access_user_ids)).toEqual([CLIENT_1, CLIENT_2]);
  });
});

describe('delivery runs belong to the campaign admin and the assigned walker', () => {
  it('through the worker', async () => {
    const path = `/v1/campaigns/${campaignId}/delivery-runs`;
    expect((await req(CLIENT_2, 'POST', path, { date: 1000 })).status).toBe(403);
    expect((await req(WALKER_1, 'POST', path, { date: 1000 })).status).toBe(403);
    expect((await req(CLIENT_1, 'POST', path, { date: 'soon' })).status).toBe(400);
    expect((await req(CLIENT_1, 'POST', '/v1/campaigns/nope/delivery-runs', { date: 1 })).status).toBe(404);
    const created = await req(CLIENT_1, 'POST', path, { date: 2000, walkerId: WALKER_1 });
    expect(created.status).toBe(201);
    expect((await req(CLIENT_1, 'POST', path, { date: 1000 })).status).toBe(201);

    for (const user of [CLIENT_1, WALKER_1, ADMIN]) {
      const list = (await req(user, 'GET', path)).body;
      expect(list.map((r: any) => r.date)).toEqual([1000, 2000]);
      expect((await req(user, 'GET', `/v1/delivery-runs/${created.body.id}`)).body).toMatchObject({ status: 'scheduled', walker_id: WALKER_1 });
    }
    for (const user of [CLIENT_2, WALKER_2]) {
      expect((await req(user, 'GET', path)).status).toBe(403);
      expect((await req(user, 'GET', `/v1/delivery-runs/${created.body.id}`)).status).toBe(404);
    }
    expect((await req(CLIENT_1, 'GET', '/v1/campaigns/nope/delivery-runs')).status).toBe(404);
  });

  it('straight at the actions', async () => {
    const params = { id: 'r1', campaign_id: campaignId, date: 1000 };
    for (const user of [CLIENT_2, WALKER_1, WALKER_2]) {
      await direct(user, 'create_delivery_run', params);
    }
    expect(row('SELECT COUNT(*) AS n FROM delivery_runs').n).toBe(0);
    await direct(CLIENT_1, 'create_delivery_run', { ...params, status: 'bogus' }).catch(() => {});
    expect(row('SELECT COUNT(*) AS n FROM delivery_runs').n).toBe(0);
    await direct(CLIENT_1, 'create_delivery_run', params);
    expect(row('SELECT COUNT(*) AS n FROM delivery_runs').n).toBe(1);
    expect(row('SELECT updated_at FROM campaigns WHERE id = ?', campaignId).updated_at).not.toBeNull();

    expect((await direct(CLIENT_2, 'list_delivery_runs', { campaign_id: campaignId })).rows).toEqual([]);
    expect((await direct(WALKER_2, 'list_delivery_runs', { campaign_id: campaignId })).rows).toEqual([]);
    expect((await direct(WALKER_2, 'get_delivery_run', { id: 'r1' })).rows).toEqual([]);
    expect((await direct(WALKER_1, 'list_delivery_runs', { campaign_id: campaignId })).rows).toHaveLength(1);
    expect((await direct(ADMIN, 'get_delivery_run', { id: 'r1' })).rows).toHaveLength(1);
  });
});

describe('ShareHire bookings', () => {
  const book = { walker_id: WALKER_1, date: 1_800_000_000_000, door_count: 100 };

  beforeEach(() => {
    db.prepare("UPDATE users SET walker_profile = '{\"ratePerDoor\":0.5}' WHERE id = ?").run(WALKER_1);
    db.prepare('UPDATE campaigns SET member_ids = ? WHERE id = ?').run(JSON.stringify([CLIENT_1, CLIENT_2]), campaignId);
  });

  it('only a campaign admin books, and the price comes from the walker rate and member count', async () => {
    expect((await req(CLIENT_2, 'POST', `/v1/campaigns/${campaignId}/bookings`, book)).status).toBe(403);
    expect((await direct(CLIENT_2, 'create_booking', { id: 'b0', campaign_id: campaignId, walker_id: WALKER_1, date: book.date, door_count: 100, created_at: 1 })).meta.changes).toBe(0);
    expect((await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/bookings`, { ...book, door_count: 0 })).status).toBe(400);
    expect((await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/bookings`, { ...book, walker_id: CLIENT_2 })).status).toBe(400);
    expect((await req(CLIENT_1, 'POST', '/v1/campaigns/nope/bookings', book)).status).toBe(404);

    expect((await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/bookings`, book)).status).toBe(201);
    expect(row('SELECT * FROM bookings')).toMatchObject({
      campaign_id: campaignId, walker_id: WALKER_1, client_id: CLIENT_1, door_count: 100,
      rate_per_door: 0.5, total_price: 50, price_per_member: 25, member_count: 2, status: 'pending',
    });
  });

  it('are listed to the campaign admin and the booked walker only', async () => {
    await req(CLIENT_1, 'POST', `/v1/campaigns/${campaignId}/bookings`, book);
    expect((await req(CLIENT_1, 'GET', `/v1/campaigns/${campaignId}/bookings`)).body).toHaveLength(1);
    expect((await req(WALKER_1, 'GET', `/v1/campaigns/${campaignId}/bookings`)).body).toHaveLength(1);
    expect((await req(WALKER_2, 'GET', `/v1/campaigns/${campaignId}/bookings`)).body).toEqual([]);
    expect((await req(CLIENT_2, 'GET', `/v1/campaigns/${campaignId}/bookings`)).body).toEqual([]);
  });
});

describe('the app worker module', () => {
  it('serves an http envelope through defineAppWorker with actions run as the caller', async () => {
    const pas = fakePas(db, CLIENT_1);
    const env = {
      APP_ID: 'doordrop',
      PAS_WORKER_TOKEN: 't',
      PAS: {
        actions: { call: (name: string, params: Record<string, unknown>) => pas.actions.call(name, params), batch: (calls: any) => pas.actions.batch(calls) },
        secrets: { get: async () => null },
        storage: { put: async () => ({}), get: async () => null },
        log: async () => true,
      },
    };
    const envelope = { id: 'e1', type: 'http', attempt: 1, payload: { method: 'GET', path: '/v1/campaigns', query: `adminId=${encodeURIComponent(CLIENT_1)}`, headers: {} }, caller: { user_id: CLIENT_1 } };
    const res = await worker.fetch(new Request('https://shim/', { method: 'POST', body: JSON.stringify(envelope) }), env, {});
    expect(res.status).toBe(200);
    const campaigns = (await res.json()) as any[];
    expect(campaigns.map((c) => c.id)).toEqual([campaignId]);
  });
});

describe('action-level authorization', () => {
  it('direct action calls enforce scoping (cross-client and cross-walker reads blocked)', async () => {
    // CLIENT_2 cannot fetch CLIENT_1's campaign directly
    expect((await direct(CLIENT_2, 'get_campaign', { id: campaignId })).rows).toHaveLength(0);
    expect((await direct(CLIENT_2, 'list_campaigns')).rows).toHaveLength(0);
    expect((await direct(CLIENT_2, 'list_doors', { campaign_id: campaignId })).rows).toHaveLength(0);
    expect((await direct(CLIENT_2, 'list_printouts', { campaign_id: campaignId })).rows).toHaveLength(0);

    // WALKER_2 cannot fetch campaign data they're not assigned to
    expect((await direct(WALKER_2, 'get_campaign', { id: campaignId })).rows).toHaveLength(0);
    expect((await direct(WALKER_2, 'list_doors', { campaign_id: campaignId })).rows).toHaveLength(0);

    // WALKER_1 can fetch the campaign they're assigned to
    expect((await direct(WALKER_1, 'get_campaign', { id: campaignId })).rows).toHaveLength(1);
    expect((await direct(WALKER_1, 'list_doors', { campaign_id: campaignId })).rows).toHaveLength(1);

    // CLIENT_1 can fetch their own campaign
    expect((await direct(CLIENT_1, 'get_campaign', { id: campaignId })).rows).toHaveLength(1);
    expect((await direct(CLIENT_1, 'list_campaigns')).rows).toHaveLength(1);
    expect((await direct(CLIENT_1, 'list_doors', { campaign_id: campaignId })).rows).toHaveLength(1);
    expect((await direct(CLIENT_1, 'list_printouts', { campaign_id: campaignId })).rows).toHaveLength(0);

    // WALKER_1 cannot fetch printouts (admin-only)
    expect((await direct(WALKER_1, 'list_printouts', { campaign_id: campaignId })).rows).toHaveLength(0);

    // History and interests scoping
    expect((await direct(WALKER_2, 'list_history', { walker_id: WALKER_1 })).rows).toHaveLength(0);
    expect((await direct(WALKER_1, 'list_history')).rows).toHaveLength(0);
  });
});

describe('admin area', () => {
  it('stats, all-doors and campaign status are app-admin only, through the worker and the actions', async () => {
    for (const user of [CLIENT_1, WALKER_1]) {
      expect((await req(user, 'GET', '/v1/admin/stats')).status).toBe(403);
      expect((await req(user, 'GET', '/v1/admin/doors')).status).toBe(403);
      expect((await req(user, 'POST', `/v1/admin/campaigns/${campaignId}/status`, { status: 'archive' })).status).toBe(403);
      expect((await direct(user, 'admin_stats')).rows).toHaveLength(0);
      expect((await direct(user, 'admin_list_doors')).rows).toHaveLength(0);
      expect((await direct(user, 'admin_set_campaign_status', { id: campaignId, status: 'archive' })).meta.changes).toBe(0);
    }
    expect(row('SELECT status FROM campaigns WHERE id = ?', campaignId).status).toBe('assigned');

    expect((await req(ADMIN, 'GET', '/v1/admin/stats')).body).toEqual({ users: 5, walkers: 2, campaigns: 1 });
    const doors = (await req(ADMIN, 'GET', '/v1/admin/doors')).body;
    expect(doors).toHaveLength(1);
    expect(doors[0]).toMatchObject({ address: '1 Elm St', campaign_name: 'Elm St drop', history: [] });

    expect((await req(ADMIN, 'POST', `/v1/admin/campaigns/${campaignId}/status`, {})).status).toBe(400);
    expect((await req(ADMIN, 'POST', `/v1/admin/campaigns/${campaignId}/status`, { status: 'bogus' })).status).toBe(400);
    expect((await direct(ADMIN, 'admin_set_campaign_status', { id: campaignId, status: 'bogus' })).meta.changes).toBe(0);
    expect((await req(ADMIN, 'POST', '/v1/admin/campaigns/nope/status', { status: 'review' })).status).toBe(404);
    expect((await req(ADMIN, 'POST', `/v1/admin/campaigns/${campaignId}/status`, { status: 'complete', job_status: 'completed' })).status).toBe(200);
    expect(row('SELECT status, job_status FROM campaigns WHERE id = ?', campaignId)).toEqual({ status: 'complete', job_status: 'completed' });
    expect(row('SELECT completed_at FROM campaigns WHERE id = ?', campaignId).completed_at).toBeGreaterThan(0);
  });
});
