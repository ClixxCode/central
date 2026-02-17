import { db } from '../src/lib/db';
import { tasks, boards } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkTask() {
  const taskId = '5a210e71-c60c-47cd-8dab-03d2beee594f';
  
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  
  if (!task) {
    console.log('Task not found');
    process.exit(0);
    return;
  }
  
  console.log('Task:');
  console.log('  ID:', task.id);
  console.log('  Title:', task.title);
  console.log('  Status:', JSON.stringify(task.status));
  console.log('  Section:', JSON.stringify(task.section));
  console.log('  BoardId:', task.boardId);
  
  // Get board
  const board = await db.query.boards.findFirst({
    where: eq(boards.id, task.boardId),
  });
  
  if (board) {
    console.log('\nBoard:');
    console.log('  Name:', board.name);
    console.log('  Status Options:', JSON.stringify(board.statusOptions, null, 2));
    
    // Check if task status matches any status option
    const matchingStatus = board.statusOptions?.find((s) => s.id === task.status);
    console.log('\nMatching status option:', matchingStatus ? JSON.stringify(matchingStatus) : 'NOT FOUND');
  }
  
  process.exit(0);
}

checkTask().catch(console.error);
