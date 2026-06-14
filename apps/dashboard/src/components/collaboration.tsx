import { AssignmentChip as NexusAssignmentChip, CommandPanel, EvidenceList, MockDataBanner, NexusCard, SafetyCriticalButton, StatusIndicator } from './nexus-ui.js';
import type { CollaborationActivityDto, CollaborationAssignmentDto, CollaborationDecisionRecordDto, CollaborationEvidencePacketDto, CollaborationMentionDto, CollaborationThreadDto, CollaborationWorkspaceDto } from '../types.js';

function ContextSummary({ context, label = 'Collaboration context' }: { context: CollaborationThreadDto['context']; label?: string }) {
  return <p aria-label={label}>Tenant <code>{context.tenantId}</code>; racetrack <code>{context.racetrackId}</code>; target {context.targetArtifact.label} (<code>{context.targetArtifact.type}:{context.targetArtifact.id}</code>).</p>;
}

function RefList({ auditRefs, eventRefs, approvalRefs, label = 'Collaboration audit and event references' }: { auditRefs: string[]; eventRefs: string[]; approvalRefs?: string[]; label?: string }) {
  return <dl aria-label={label}><div><dt>Audit refs</dt><dd>{auditRefs.map((ref) => <code key={ref}>{ref} </code>)}</dd></div><div><dt>Event refs</dt><dd>{eventRefs.map((ref) => <code key={ref}>{ref} </code>)}</dd></div>{approvalRefs && <div><dt>Approval refs</dt><dd>{approvalRefs.map((ref) => <code key={ref}>{ref} </code>)}</dd></div>}</dl>;
}

export function ActiveParticipants({ participants, label = 'Active collaboration participants' }: { participants: CollaborationWorkspaceDto['activeParticipants']; label?: string }) {
  return <ul className="active-participants" aria-label={label}>{participants.map((participant) => <li key={participant.id}><strong>{participant.displayName}</strong><p>{participant.role}; {participant.actorType}</p></li>)}</ul>;
}

export function MentionNotification({ mention }: { mention: CollaborationMentionDto }) {
  return <p className="mention-notification" role="status" aria-label={`Mention notification for ${mention.actor.displayName}`} data-tone={mention.read ? 'info' : 'warning'}>@{mention.actor.id} {mention.message} Target <code>{mention.context.targetArtifact.type}:{mention.context.targetArtifact.id}</code>; tenant <code>{mention.context.tenantId}</code>; racetrack <code>{mention.context.racetrackId}</code>; audit <code>{mention.auditRef}</code>; event <code>{mention.eventRef}</code>.</p>;
}

export function ActivityFeed({ activity, label = 'Collaboration activity feed' }: { activity: CollaborationActivityDto[]; label?: string }) {
  if (activity.length === 0) return <p role="status" aria-label={`${label} empty`}>No collaboration activity recorded for this artifact.</p>;
  return <ol className="activity-feed" aria-label={label}>{activity.map((item) => <li key={item.id} data-tone="info"><time>{item.occurredAt}</time> <strong>{item.kind}</strong> by {item.actor.displayName}: {item.summary}<ContextSummary context={item.context} label={`${item.id} context`} /><p>Audit <code>{item.auditRef}</code>; event <code>{item.eventRef}</code>.</p></li>)}</ol>;
}

export function CommentThreadView({ thread }: { thread: CollaborationThreadDto }) {
  return <CommandPanel title={thread.title} label={`Comment thread ${thread.title}`} mock={thread.mock}>
    <StatusIndicator label={thread.status} />
    <ContextSummary context={thread.context} label="Thread tenant racetrack and target context" />
    <ActiveParticipants participants={thread.participants} label={`${thread.title} participants`} />
    <ol aria-label={`${thread.title} comments`}>{thread.comments.map((comment) => <li key={comment.id}><article aria-label={`Comment by ${comment.author.displayName}`}><strong>{comment.author.displayName}</strong> <time>{comment.createdAt}</time><p>{comment.body}</p><p>Draft only {String(comment.draftOnly)}; execution allowed {String(comment.executionAllowed)}.</p><p>Audit <code>{comment.auditRef}</code>; event <code>{comment.eventRef}</code></p>{comment.mentions.length > 0 && <ul aria-label={`${comment.id} mentions`}>{comment.mentions.map((mention) => <li key={mention.id}>{mention.actor.displayName}: <code>{mention.auditRef}</code> / <code>{mention.eventRef}</code></li>)}</ul>}</article></li>)}</ol>
    <RefList auditRefs={thread.auditRefs} eventRefs={thread.eventRefs} approvalRefs={thread.context.approvalRefs} label={`${thread.title} audit event and approval references`} />
  </CommandPanel>;
}

export function AssignmentChip({ assignment }: { assignment: CollaborationAssignmentDto }) {
  return <NexusAssignmentChip assigneeId={assignment.assignee.displayName} status={assignment.status} priority={assignment.priority} />;
}

export function AssignmentList({ assignments, label = 'Collaboration assignments' }: { assignments: CollaborationAssignmentDto[]; label?: string }) {
  if (assignments.length === 0) return <p role="status" aria-label={`${label} empty`}>No collaboration assignments attached.</p>;
  return <ul aria-label={label}>{assignments.map((assignment) => <li key={assignment.id}><AssignmentChip assignment={assignment} /><p>{assignment.title}; due {assignment.dueAt ?? 'not scheduled'}; priority {assignment.priority}.</p><ContextSummary context={assignment.context} label={`${assignment.id} context`} /><EvidenceList items={assignment.evidenceRefs} label={`${assignment.id} evidence`} /><p>Audit <code>{assignment.auditRef}</code>; event <code>{assignment.eventRef}</code>; execution allowed {String(assignment.executionAllowed)}.</p></li>)}</ul>;
}

export function DecisionLog({ decisions, label = 'Collaboration decision log' }: { decisions: CollaborationDecisionRecordDto[]; label?: string }) {
  return <section aria-label={label}>{decisions.length ? decisions.map((decision) => <article key={decision.id}><StatusIndicator label={decision.status} /><strong>{decision.decision}</strong><p>{decision.rationale}</p><ContextSummary context={decision.context} label={`${decision.id} context`} /><EvidenceList items={decision.evidencePacketIds} label={`${decision.id} evidence packets`} /><RefList auditRefs={decision.auditRefs} eventRefs={decision.eventRefs} label={`${decision.id} audit event references`} /><small>Recorded by {decision.decidedBy.displayName}; draft only {String(decision.draftOnly)}; execution allowed {String(decision.executionAllowed)}.</small></article>) : <p role="status">No decision records attached.</p>}</section>;
}

export function EvidencePacketViewer({ packets, label = 'Collaboration evidence packet viewer' }: { packets: CollaborationEvidencePacketDto[]; label?: string }) {
  return <section aria-label={label}>{packets.length ? packets.map((packet) => <NexusCard key={packet.id} title={packet.title} detail={packet.summary} mock={packet.mock} tone={packet.sealed ? 'ok' : 'warning'}><ContextSummary context={packet.context} label={`${packet.id} context`} /><EvidenceList items={packet.evidenceRefs} label={`${packet.id} evidence refs`} /><RefList auditRefs={packet.auditRefs} eventRefs={packet.eventRefs} approvalRefs={packet.approvalRef ? [packet.approvalRef] : undefined} label={`${packet.id} audit event and approval references`} /><p>Sealed: {String(packet.sealed)}</p></NexusCard>) : <p role="status">No evidence packet records attached.</p>}</section>;
}

export function CollaborationPanel({ workspace }: { workspace: CollaborationWorkspaceDto }) {
  return <CommandPanel title="Collaboration Panel" label="Shared collaboration panel" description={`Tenant ${workspace.tenantId}; racetrack ${workspace.racetrackId}; generated ${workspace.generatedAt}.`} mock={workspace.mock} actions={<SafetyCriticalButton approvalsSatisfied={false} backendLive={false} authenticated={false} describedById="collaboration-safety-lock" ariaLabel="Disabled collaboration operational execution" reason={workspace.safety.disabledControlReason}>Promote collaboration to operation</SafetyCriticalButton>}>
    <MockDataBanner active={workspace.mock} source="collaboration mock/live adapter" />
    <p role="status" aria-label="Collaboration safety boundary">Collaboration only {String(workspace.safety.collaborationOnly)}; draft posts {String(workspace.safety.draftOnlyPosts)}; mutates operational state {String(workspace.safety.mutatesOperationalState)}.</p>
    <ActiveParticipants participants={workspace.activeParticipants} />
    <section aria-label="Mention notifications">{workspace.mentions.map((mention) => <MentionNotification key={mention.id} mention={mention} />)}</section>
    <ActivityFeed activity={workspace.activity} />
    <section aria-label="Collaboration comment threads">{workspace.threads.map((thread) => <CommentThreadView key={thread.id} thread={thread} />)}</section>
    <AssignmentList assignments={workspace.assignments} />
    <DecisionLog decisions={workspace.decisionRecords} />
    <EvidencePacketViewer packets={workspace.evidencePackets} />
    <section aria-label="Approval discussions">{workspace.approvalDiscussions.map((discussion) => <NexusCard key={discussion.id} title={`Approval discussion ${discussion.approvalId}`} status={discussion.status} mock={discussion.mock}><ContextSummary context={discussion.context} label={`${discussion.id} context`} /><p>Thread <code>{discussion.threadId}</code>; roles {discussion.requiredRoles.join(', ')}</p><RefList auditRefs={discussion.auditRefs} eventRefs={discussion.eventRefs} approvalRefs={[discussion.approvalId]} /></NexusCard>)}</section>
    <section aria-label="Incident collaboration rooms">{workspace.incidentRooms.map((room) => <NexusCard key={room.id} title={room.title} status={room.status} tone={room.severity} mock={room.mock}><ContextSummary context={room.context} label={`${room.id} context`} /><p>Incident <code>{room.incidentId}</code>; participants {room.participantIds.join(', ')}; threads {room.threadIds.join(', ')}</p><RefList auditRefs={room.auditRefs} eventRefs={room.eventRefs} /></NexusCard>)}</section>
  </CommandPanel>;
}
