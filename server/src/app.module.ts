import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { DashboardModule } from './dashboard/dashboard.module';
import { ServersModule } from './servers/servers.module';
import { ProjectsModule } from './projects/projects.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { BillingModule } from './billing/billing.module';
import { SettingsModule } from './settings/settings.module';
// import { LogsModule } from './logs/logs.module';
import { TemplatesModule } from './templates/templates.module';
import { FilesModule } from './files/files.module';
import { LogsModule } from './logs/logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    ServersModule,
    ProjectsModule,
    DeploymentsModule,
    BillingModule,
    SettingsModule,
    LogsModule,
    TemplatesModule,
    FilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
