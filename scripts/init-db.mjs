import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_BYTES = 32;

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_BYTES);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    // Create super admin
    const superAdminPassword = await hashPassword('superadmin123');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'admin@ai-avengers.com' },
      update: { password_hash: superAdminPassword },
      create: {
        name: 'Super Admin',
        email: 'admin@ai-avengers.com',
        password_hash: superAdminPassword,
        role: 'super_admin',
      },
    });
    console.log('Created super admin:', superAdmin.email);

    // Create agency member
    const agencyPassword = await hashPassword('agency123456');
    const agency = await prisma.user.upsert({
      where: { email: 'agency@ai-avengers.com' },
      update: { password_hash: agencyPassword },
      create: {
        name: 'Agency Member',
        email: 'agency@ai-avengers.com',
        password_hash: agencyPassword,
        role: 'agency_member',
      },
    });
    console.log('Created agency member:', agency.email);

    // Create client admin
    const clientPassword = await hashPassword('client123456');
    const client = await prisma.user.upsert({
      where: { email: 'client@ai-avengers.com' },
      update: { password_hash: clientPassword },
      create: {
        name: 'Client Admin',
        email: 'client@ai-avengers.com',
        password_hash: clientPassword,
        role: 'client_admin',
      },
    });
    console.log('Created client admin:', client.email);

    // Create sample project
    const project = await prisma.project.upsert({
      where: { slug: 'demo-project' },
      update: {},
      create: {
        name: 'Demo Project',
        slug: 'demo-project',
      },
    });
    console.log('Created project:', project.name);

    // Create membership for client admin
    await prisma.membership.upsert({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: client.id,
        },
      },
      update: {},
      create: {
        projectId: project.id,
        userId: client.id,
      },
    });
    console.log('Created membership for client admin');

    // Create sample tasks
    const task1 = await prisma.task.create({
      data: {
        projectId: project.id,
        createdBy: client.id,
        requestId: 'REQ-001',
        title: 'Setup authentication system',
        instructions: 'Implement email/password auth with Prisma',
        checklist: ['Create login page', 'Create signup flow', 'Add password change'],
        caption: 'Auth System',
        referenceUrl: 'https://example.com/auth-docs',
        accessLabel: 'Admin Panel',
        accessUrl: 'https://admin.example.com',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
      },
    });
    console.log('Created task:', task1.title);

    const task2 = await prisma.task.create({
      data: {
        projectId: project.id,
        createdBy: client.id,
        requestId: 'REQ-002',
        title: 'Build dashboard UI',
        instructions: 'Create responsive dashboard with task list',
        checklist: ['Design mockups', 'Implement components', 'Add dark mode'],
        caption: 'UI/UX',
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'in_progress',
      },
    });
    console.log('Created task:', task2.title);

    console.log('\n✅ Database initialized successfully!');
    console.log('\nTest accounts:');
    console.log('  Super Admin: admin@ai-avengers.com / superadmin123');
    console.log('  Agency Member: agency@ai-avengers.com / agency123456');
    console.log('  Client Admin: client@ai-avengers.com / client123456');

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();