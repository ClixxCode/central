import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { hash } from 'bcryptjs';
import * as schema from '../src/lib/db/schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPasswordHash = await hash('admin123', 12);
  const [adminUser] = await db
    .insert(schema.users)
    .values({
      email: 'admin@clix.co',
      name: 'Admin User',
      role: 'admin',
      authProvider: 'credentials',
      passwordHash: adminPasswordHash,
    })
    .returning();
  console.log('✓ Created admin user:', adminUser.email);

  // Create regular users
  const userPasswordHash = await hash('user123', 12);
  const [johnUser] = await db
    .insert(schema.users)
    .values({
      email: 'john@clix.co',
      name: 'John Doe',
      role: 'user',
      authProvider: 'credentials',
      passwordHash: userPasswordHash,
    })
    .returning();
  console.log('✓ Created user:', johnUser.email);

  const [janeUser] = await db
    .insert(schema.users)
    .values({
      email: 'jane@clix.co',
      name: 'Jane Smith',
      role: 'user',
      authProvider: 'credentials',
      passwordHash: userPasswordHash,
    })
    .returning();
  console.log('✓ Created user:', janeUser.email);

  // Create teams
  const [seoTeam] = await db
    .insert(schema.teams)
    .values({ name: 'SEO Team' })
    .returning();
  console.log('✓ Created team:', seoTeam.name);

  const [devTeam] = await db
    .insert(schema.teams)
    .values({ name: 'Dev Team' })
    .returning();
  console.log('✓ Created team:', devTeam.name);

  // Add users to teams
  await db.insert(schema.teamMembers).values([
    { teamId: seoTeam.id, userId: johnUser.id },
    { teamId: devTeam.id, userId: janeUser.id },
  ]);
  console.log('✓ Added users to teams');

  // Create clients
  const [acmeClient] = await db
    .insert(schema.clients)
    .values({
      name: 'Acme Corporation',
      slug: 'acme',
      color: '#3B82F6',
      createdBy: adminUser.id,
    })
    .returning();
  console.log('✓ Created client:', acmeClient.name);

  const [techStartClient] = await db
    .insert(schema.clients)
    .values({
      name: 'TechStart Inc',
      slug: 'techstart',
      color: '#10B981',
      createdBy: adminUser.id,
    })
    .returning();
  console.log('✓ Created client:', techStartClient.name);

  // Create boards with custom sections
  const [acmeMainBoard] = await db
    .insert(schema.boards)
    .values({
      clientId: acmeClient.id,
      name: 'Main Board',
      type: 'standard',
      sectionOptions: [
        { id: 'seo', label: 'SEO', color: '#8B5CF6', position: 0 },
        { id: 'web-dev', label: 'Web Dev', color: '#EC4899', position: 1 },
        { id: 'ppc', label: 'PPC', color: '#F97316', position: 2 },
        { id: 'content', label: 'Content', color: '#14B8A6', position: 3 },
      ],
      createdBy: adminUser.id,
    })
    .returning();
  console.log('✓ Created board:', acmeMainBoard.name);

  const [acmeCampaignBoard] = await db
    .insert(schema.boards)
    .values({
      clientId: acmeClient.id,
      name: 'Q1 Campaign',
      type: 'standard',
      sectionOptions: [
        { id: 'planning', label: 'Planning', color: '#6366F1', position: 0 },
        { id: 'creative', label: 'Creative', color: '#EC4899', position: 1 },
        { id: 'execution', label: 'Execution', color: '#F59E0B', position: 2 },
      ],
      createdBy: adminUser.id,
    })
    .returning();
  console.log('✓ Created board:', acmeCampaignBoard.name);

  const [techStartBoard] = await db
    .insert(schema.boards)
    .values({
      clientId: techStartClient.id,
      name: 'Dev Board',
      type: 'standard',
      sectionOptions: [
        { id: 'frontend', label: 'Frontend', color: '#3B82F6', position: 0 },
        { id: 'backend', label: 'Backend', color: '#10B981', position: 1 },
        { id: 'devops', label: 'DevOps', color: '#F97316', position: 2 },
      ],
      createdBy: adminUser.id,
    })
    .returning();
  console.log('✓ Created board:', techStartBoard.name);

  // Grant board access
  await db.insert(schema.boardAccess).values([
    // SEO team has full access to Acme main board
    { boardId: acmeMainBoard.id, teamId: seoTeam.id, accessLevel: 'full' },
    // Dev team has full access to all boards
    { boardId: acmeMainBoard.id, teamId: devTeam.id, accessLevel: 'full' },
    { boardId: acmeCampaignBoard.id, teamId: devTeam.id, accessLevel: 'full' },
    { boardId: techStartBoard.id, teamId: devTeam.id, accessLevel: 'full' },
    // John also has direct access to campaign board
    { boardId: acmeCampaignBoard.id, userId: johnUser.id, accessLevel: 'full' },
  ]);
  console.log('✓ Granted board access');

  // Create sample tasks
  const [task1] = await db
    .insert(schema.tasks)
    .values({
      boardId: acmeMainBoard.id,
      title: 'Update homepage copy',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'We need to update the homepage copy to reflect the new Q1 messaging.' },
            ],
          },
        ],
      },
      status: 'todo',
      section: 'content',
      dueDate: '2024-02-15',
      dateFlexibility: 'not_flexible',
      position: 0,
      createdBy: adminUser.id,
    })
    .returning();

  const [task2] = await db
    .insert(schema.tasks)
    .values({
      boardId: acmeMainBoard.id,
      title: 'SEO audit for main pages',
      status: 'in-progress',
      section: 'seo',
      dueDate: '2024-02-20',
      dateFlexibility: 'flexible',
      position: 0,
      createdBy: johnUser.id,
    })
    .returning();

  const [task3] = await db
    .insert(schema.tasks)
    .values({
      boardId: acmeMainBoard.id,
      title: 'Fix mobile navigation',
      status: 'todo',
      section: 'web-dev',
      dueDate: '2024-02-10',
      dateFlexibility: 'semi_flexible',
      position: 1,
      createdBy: janeUser.id,
    })
    .returning();

  const [task4] = await db
    .insert(schema.tasks)
    .values({
      boardId: techStartBoard.id,
      title: 'Implement user authentication',
      status: 'in-progress',
      section: 'backend',
      dueDate: '2024-02-25',
      dateFlexibility: 'not_flexible',
      position: 0,
      createdBy: janeUser.id,
    })
    .returning();

  console.log('✓ Created sample tasks');

  // Assign users to tasks
  await db.insert(schema.taskAssignees).values([
    { taskId: task1.id, userId: johnUser.id },
    { taskId: task1.id, userId: janeUser.id },
    { taskId: task2.id, userId: johnUser.id },
    { taskId: task3.id, userId: janeUser.id },
    { taskId: task4.id, userId: janeUser.id },
  ]);
  console.log('✓ Assigned users to tasks');

  // Create sample comments
  await db.insert(schema.comments).values({
    taskId: task1.id,
    authorId: johnUser.id,
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: "I've reviewed the current copy. We should focus on the hero section first." },
          ],
        },
      ],
    },
  });
  console.log('✓ Created sample comments');

  // Create sample notification
  await db.insert(schema.notifications).values({
    userId: janeUser.id,
    type: 'task_assigned',
    taskId: task1.id,
    title: 'You were assigned to a task',
    body: 'Admin User assigned you to "Update homepage copy"',
  });
  console.log('✓ Created sample notifications');

  console.log('\n✅ Database seed completed successfully!');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
