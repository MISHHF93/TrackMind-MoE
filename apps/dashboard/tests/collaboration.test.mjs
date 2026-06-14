import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createLiveClient, createMockClient } from '../dist/api/client.js';
import { collaborationAssignmentDraftPayload, collaborationCommentDraftPayload, requestCollaborationAssignmentDraft, requestCollaborationCommentDraft } from '../dist/App.js';
import { AssignmentList, CollaborationPanel, CommentThreadView } from '../dist/components/collaboration.js';

function fetchStub(responseBody, calls) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async json() {
        return responseBody;
      },
    };
  };
}

test('mock collaboration adapter exposes collaboration records', async () => {
  const client = createMockClient();
  const workspace = await client.getCollaborationWorkspace();

  assert.equal(workspace.safety.collaborationOnly, true);
  assert.equal(workspace.safety.mutatesOperationalState, false);
  assert.ok(workspace.threads.length > 0);
  assert.ok(workspace.mentions.length > 0);
  assert.ok(workspace.assignments.length > 0);
  assert.ok(workspace.decisionRecords.length > 0);
  assert.ok(workspace.evidencePackets.length > 0);
  assert.ok(workspace.approvalDiscussions.length > 0);
  assert.ok(workspace.incidentRooms.length > 0);
});

test('live collaboration adapter calls typed paths', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub([], calls);
  try {
    const client = createLiveClient('https://trackmind.test/api/v1');
    await client.listCollaborationThreads();
    await client.listCollaborationActivity();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, 'https://trackmind.test/api/v1/collaboration/threads');
  assert.equal(calls[1].url, 'https://trackmind.test/api/v1/collaboration/activity');
});

test('comment creation helper sends draft-only collaboration payload', async () => {
  const mock = createMockClient();
  const workspace = await mock.getCollaborationWorkspace();
  const context = workspace.threads[0].context;
  const actor = workspace.activeParticipants[0];
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub(workspace.threads[0].comments[0], calls);
  try {
    const client = createLiveClient('https://trackmind.test/api/v1');
    await requestCollaborationCommentDraft(client, {
      context,
      actor,
      threadId: workspace.threads[0].id,
      body: 'Draft-only collaboration comment.',
      mentionActorIds: ['steward-1'],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const payload = JSON.parse(String(calls[0].init.body));
  assert.equal(calls[0].url, 'https://trackmind.test/api/v1/collaboration/comments');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(payload.draftOnly, true);
  assert.equal(payload.executionAllowed, false);
  assert.equal(payload.collaborationOnly, true);
  assert.equal(payload.context.targetArtifact.id, 'race-7');
  assert.deepEqual(payload.mentionActorIds, ['steward-1']);
});

test('assignment creation helper sends draft-only collaboration payload', async () => {
  const mock = createMockClient();
  const workspace = await mock.getCollaborationWorkspace();
  const context = workspace.threads[0].context;
  const actor = workspace.activeParticipants[0];
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub(workspace.assignments[0], calls);
  try {
    const client = createLiveClient('https://trackmind.test/api/v1');
    await requestCollaborationAssignmentDraft(client, {
      context,
      actor,
      title: 'Review far-turn packet',
      assigneeId: 'steward-1',
      priority: 'high',
      evidenceRefs: ['surface:far-turn'],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const payload = JSON.parse(String(calls[0].init.body));
  assert.equal(calls[0].url, 'https://trackmind.test/api/v1/collaboration/assignments');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(payload.draftOnly, true);
  assert.equal(payload.executionAllowed, false);
  assert.equal(payload.collaborationOnly, true);
  assert.equal(payload.assigneeId, 'steward-1');
  assert.deepEqual(payload.evidenceRefs, ['surface:far-turn']);
});

test('collaboration draft payload builders enforce safety flags', async () => {
  const workspace = await createMockClient().getCollaborationWorkspace();
  const context = workspace.threads[0].context;
  const actor = workspace.activeParticipants[0];

  assert.equal(collaborationCommentDraftPayload({ context, actor, threadId: 'thread-1', body: 'hello', mentionActorIds: [] }).executionAllowed, false);
  assert.equal(collaborationAssignmentDraftPayload({ context, actor, title: 'Task', assigneeId: 'steward-1', priority: 'medium', evidenceRefs: [] }).collaborationOnly, true);
});

test('collaboration components render context, labels, and disabled controls', async () => {
  const workspace = await createMockClient().getCollaborationWorkspace();
  const panel = renderToStaticMarkup(React.createElement(CollaborationPanel, { workspace }));
  const thread = renderToStaticMarkup(React.createElement(CommentThreadView, { thread: workspace.threads[0] }));
  const assignments = renderToStaticMarkup(React.createElement(AssignmentList, { assignments: workspace.assignments }));

  assert.match(panel, /aria-label="Shared collaboration panel"/);
  assert.match(panel, /aria-label="Mention notifications"/);
  assert.match(panel, /Tenant <code>mock-track<\/code>; racetrack <code>mock-main-track<\/code>/);
  assert.match(panel, /aria-label="Disabled collaboration operational execution"/);
  assert.match(panel, /disabled=""/);
  assert.match(thread, /aria-label="Comment thread Race 7 approval discussion"/);
  assert.match(thread, /audit-collab-comment-1/);
  assert.match(assignments, /aria-label="Collaboration assignments"/);
  assert.match(assignments, /execution allowed false/);
});
