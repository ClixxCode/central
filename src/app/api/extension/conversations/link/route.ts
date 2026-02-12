import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import { frontConversations, tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  let body: {
    taskId: string;
    conversationId: string;
    subject?: string;
    conversationUrl?: string;
    conversationMeta?: {
      url?: string;
      subject?: string | null;
      sender?: string | null;
      senderEmail?: string | null;
      recipient?: string | null;
      date?: string | null;
      body?: string | null;
      preview?: string | null;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  // If conversationId doesn't have cnv_ prefix but conversationUrl does, extract from URL
  if (body.conversationId && !body.conversationId.startsWith('cnv_') && body.conversationUrl) {
    const urlMatch = body.conversationUrl.match(/(cnv_[a-zA-Z0-9]+)/);
    if (urlMatch) {
      body.conversationId = urlMatch[1];
    }
  }

  if (!body.taskId || !body.conversationId) {
    return NextResponse.json(
      { error: 'taskId and conversationId are required' },
      { status: 400, headers }
    );
  }

  // Verify task exists (include description for appending card)
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, body.taskId),
    columns: { id: true, description: true },
  });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404, headers });
  }

  try {
    const [link] = await db
      .insert(frontConversations)
      .values({
        taskId: body.taskId,
        conversationId: body.conversationId,
        subject: body.subject ?? null,
        linkedBy: user.id,
      })
      .onConflictDoUpdate({
        target: [frontConversations.taskId, frontConversations.conversationId],
        set: { subject: body.subject ?? null },
      })
      .returning();

    // Append a frontConversation card to the task description if conversationMeta provided
    if (body.conversationMeta?.url) {
      const cardNode = {
        type: 'frontConversation',
        attrs: {
          url: body.conversationMeta.url,
          subject: body.conversationMeta.subject || null,
          sender: body.conversationMeta.sender || null,
          senderEmail: body.conversationMeta.senderEmail || null,
          recipient: body.conversationMeta.recipient || null,
          date: body.conversationMeta.date || null,
          body: body.conversationMeta.body || body.conversationMeta.preview || null,
        },
      };

      const existing = task.description as { type?: string; content?: any[] } | null;
      let newDescription: any;

      if (existing?.type === 'doc' && Array.isArray(existing.content)) {
        // Append card to existing content
        newDescription = { ...existing, content: [...existing.content, cardNode] };
      } else {
        // No existing description — create doc with just the card
        newDescription = { type: 'doc', content: [cardNode] };
      }

      await db.update(tasks).set({ description: newDescription }).where(eq(tasks.id, body.taskId));
    }

    return NextResponse.json(
      { id: link.id, taskId: link.taskId, conversationId: link.conversationId },
      { status: 201, headers }
    );
  } catch (error) {
    console.error('Failed to link conversation:', error);
    return NextResponse.json({ error: 'Failed to link conversation' }, { status: 500, headers });
  }
}
