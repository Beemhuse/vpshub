import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding templates...');

  const templates = [
    {
      id: 'static-html',
      name: 'Static HTML',
      type: 'STATIC',
      description: 'Simple static HTML/CSS/JS site',
      outputDir: '.',
    },
    {
      id: 'react-static',
      name: 'React (Static)',
      type: 'STATIC',
      description: 'React application deployed as static files',
      installCmd: 'npm install',
      buildCmd: 'npm run build',
      outputDir: 'dist',
    },
    {
      id: 'nextjs-static',
      name: 'Next.js (Static)',
      type: 'STATIC',
      description: 'Next.js application exported as static files',
      installCmd: 'npm install',
      buildCmd: 'npm run build',
      outputDir: 'out',
    },
    {
      id: 'nodejs-source',
      name: 'Node.js (Source)',
      type: 'NODE',
      description: 'Node.js application started with PM2',
      installCmd: 'npm install',
      startCmd: 'npm start',
      defaultPort: 3000,
    },
    {
      id: 'nextjs-ssr',
      name: 'Next.js (SSR)',
      type: 'NODE',
      description: 'Next.js application with Server-Side Rendering',
      installCmd: 'npm install',
      buildCmd: 'npm run build',
      startCmd: 'npm start',
      defaultPort: 3000,
    },
    {
      id: 'docker-image',
      name: 'Docker Image',
      type: 'DOCKER',
      description: 'Deploy any Docker image from a registry',
      defaultPort: 80,
    },
  ];

  for (const template of templates) {
    try {
      console.log(`Upserting template: ${template.name} (${template.id})`);
      await prisma.template.upsert({
        where: { id: template.id },
        update: template,
        create: template,
      });
    } catch (error: any) {
      console.error(`Failed to upsert template ${template.name}:`, error);
      if (error.code) console.error(`Error code: ${error.code}`);
      if (error.meta) console.error(`Error meta:`, error.meta);
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
