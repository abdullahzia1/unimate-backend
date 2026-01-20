import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { AccessLevelGuard } from '../../common/guards/access-level.guard';
import { RequireAccessLevel } from '../../common/decorators/access-level.decorator';
import { AccessLevel } from '../../database/entities/user.entity';
import { CreatePendingAccountDto } from './dto/create-pending-account.dto';
import { AccountApprovalService } from './account-approval.service';

@Controller('account-approval')
export class AccountApprovalController {
  constructor(
    private readonly accountApprovalService: AccountApprovalService,
  ) {}

  /**
   * Create pending account request
   */
  @Post('pending')
  async createPendingAccount(
    @Body() createPendingAccountDto: CreatePendingAccountDto,
  ) {
    const id = await this.accountApprovalService.createPendingAccount(
      createPendingAccountDto,
    );

    return {
      success: true,
      message: 'Pending account request created successfully',
      id,
    };
  }

  /**
   * Get pending accounts
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async getPendingAccounts(@CurrentUser() user: JwtPayload) {
    const pendingAccounts =
      await this.accountApprovalService.getPendingAccounts(
        user.accessLevel || null,
      );

    return {
      success: true,
      pendingAccounts,
    };
  }

  /**
   * Approve pending account
   */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async approveAccount(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.accountApprovalService.approveAccount(
      id,
      user.sub,
      user.accessLevel || null,
    );

    return {
      success: true,
      message: 'Account approved successfully',
    };
  }

  /**
   * Reject pending account
   */
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async rejectAccount(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.accountApprovalService.rejectAccount(
      id,
      user.sub,
      user.accessLevel || null,
    );

    return {
      success: true,
      message: 'Account rejected successfully',
    };
  }
}
