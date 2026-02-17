import { db } from '../src/lib/db';
import { tasks, boards } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixTaskStatus() {
  const taskId = '5a210e71-c60c-47cd-8dab-03d2beee594f';
  
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  
  if (!task) {
    console.log('Task not found');
    process.exit(1);
    return;
  }
  
  // Get board
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, task.boardId),
  });
  
  if (!board || !board.statusOptions) {
    console.log('Board not found or no status options');
    process.exit(1);
    return;
  }
  
  // Find the matching status option (case insensitive by label)
  const matchingStatus = board.statusOptions.find(
    (s) => s.label.toLowerCase() === task.status.toLowerCase() || s.id === task.status
  );
  
  if (!matchingStatus) {
    console.log('No matching status option found for:', task.status);
    process.exit(1);
    return;
  }
  
  console.log('Current task status:', task.status);
  console.log('Matching status option:', matchingStatus);
  console.log('Correct status ID should be:', matchingStatus.id);
  
  if (task.status !== matchingStatus.id) {
    // Update the task with the correct status ID
    await db.update(tasks)
      .set({ status: matchingStatus.id })
      .where(eq(tasks.id, taskId));
    
    console.log('Updated task status from', JSON.stringify(task.status), 'to', JSON.stringify(matchingStatus.id));
  } else {
    console.log('Task status is already correct');
  }
  
  process.exit(0);
}

fixTaskStatus().catch(console.error);
