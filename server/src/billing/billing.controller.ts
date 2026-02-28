import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'Get billing invoices' })
  getInvoices(@Req() req) {
    return this.billingService.getInvoices(req.user.id);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get current usage statistics' })
  getUsage(@Req() req) {
    return this.billingService.getUsage(req.user.id);
  }
}
