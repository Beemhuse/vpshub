ALTER TABLE "Project"
ADD COLUMN "serviceDomains" JSONB;

ALTER TABLE "Deployment"
ADD COLUMN "serviceDomains" JSONB;
