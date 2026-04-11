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
      id: 'react-vite',
      name: 'React (Vite)',
      type: 'STATIC',
      description: 'React application built with Vite',
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
      id: 'vue-static',
      name: 'Vue.js (Static)',
      type: 'STATIC',
      description: 'Vue application built with Vite/Vue CLI',
      installCmd: 'npm install',
      buildCmd: 'npm run build',
      outputDir: 'dist',
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
      id: 'strapi-cms',
      name: 'Strapi CMS',
      type: 'NODE',
      description: 'Open-source headless CMS in Node.js',
      installCmd: 'npm install',
      buildCmd: 'npm run build',
      startCmd: 'npm run start',
      defaultPort: 1337,
    },
    {
      id: 'docker-compose',
      name: 'Docker / Docker Compose',
      type: 'DOCKER',
      description: 'Deploy from GitHub with docker-compose.yml or Dockerfile',
      defaultPort: 80,
    },
    {
      id: 'postgres-db',
      name: 'PostgreSQL',
      type: 'DOCKER',
      description: 'Reliable relational database service',
      image: 'postgres:latest',
      defaultPort: 5432,
    },
    {
      id: 'redis-db',
      name: 'Redis',
      type: 'DOCKER',
      description: 'Flash-fast in-memory data storage',
      image: 'redis:latest',
      defaultPort: 6379,
    },
    {
      id: 'wordpress-app',
      name: 'WordPress',
      type: 'DOCKER',
      description: 'The world\'s most popular CMS',
      image: 'wordpress:latest',
      defaultPort: 80,
    },
    {
      id: 'laravel-docker',
      name: 'Laravel (Docker)',
      type: 'DOCKER',
      description: 'PHP Framework for Web Artisans',
      defaultPort: 80,
    },
    {
      id: 'flask-app',
      name: 'Flask (Python)',
      type: 'DOCKER',
      description: 'Python lightweight web application',
      defaultPort: 5000,
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
