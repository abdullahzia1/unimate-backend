import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import { AccessLevelGuard } from '../../common/guards/access-level.guard';
import { RequireAccessLevel } from '../../common/decorators/access-level.decorator';
import { AccessLevel } from '../../database/entities/user.entity';
import { canManageAccount } from '../../common/utils/access-control.util';
import {
  ChangePasswordDto,
  ChangeOwnPasswordDto,
} from './dto/change-password.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create admin account
   */
  @Post('accounts')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async createAccount(
    @Body() createAccountDto: CreateAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Validate account management permission
    if (
      !canManageAccount(user.accessLevel || null, createAccountDto.accessLevel)
    ) {
      throw new Error(
        'You do not have permission to create accounts with this access level',
      );
    }

    // Prevent head users from creating head accounts
    if (
      user.accessLevel === AccessLevel.HEAD &&
      createAccountDto.accessLevel === AccessLevel.HEAD
    ) {
      throw new Error('Head users cannot create other head accounts');
    }

    const uid = await this.userService.createAccount(
      createAccountDto,
      user.sub,
    );

    return {
      success: true,
      message: 'Account created successfully',
      uid,
    };
  }

  /**
   * Update admin account
   */
  @Put('accounts/:id')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async updateAccount(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Get current account to check access level
    const currentAccount = await this.userService.findById(id);
    if (!currentAccount) {
      throw new Error('Account not found');
    }

    // Validate account management permission
    if (updateAccountDto.accessLevel) {
      if (
        !canManageAccount(
          user.accessLevel || null,
          updateAccountDto.accessLevel,
        )
      ) {
        throw new Error(
          'You do not have permission to update accounts to this access level',
        );
      }
    } else if (!currentAccount.accessLevel) {
      throw new Error('Account does not have an access level');
    } else if (
      !canManageAccount(user.accessLevel || null, currentAccount.accessLevel)
    ) {
      throw new Error('You do not have permission to manage this account');
    }

    await this.userService.updateAccount(id, updateAccountDto, user.sub);

    return {
      success: true,
      message: 'Account updated successfully',
    };
  }

  /**
   * Delete admin account
   */
  @Delete('accounts/:id')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async deleteAccount(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Get current account to check access level
    const currentAccount = await this.userService.findById(id);
    if (!currentAccount) {
      throw new Error('Account not found');
    }

    // Validate account management permission
    if (!currentAccount.accessLevel) {
      throw new Error('Account does not have an access level');
    }
    if (
      !canManageAccount(user.accessLevel || null, currentAccount.accessLevel)
    ) {
      throw new Error('You do not have permission to delete this account');
    }

    await this.userService.deleteAccount(id, user.sub);

    return {
      success: true,
      message: 'Account deleted successfully',
    };
  }

  /**
   * Get admin accounts (hierarchical)
   */
  @Get('accounts')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(
    AccessLevel.SUPER,
    AccessLevel.SUPREME,
    AccessLevel.HEAD,
    AccessLevel.CUSTODIAN,
  )
  async getAdminAccounts(@CurrentUser() user: JwtPayload) {
    const accounts = await this.userService.getAdminAccounts(
      user.accessLevel || null,
      user.departmentId || null,
    );

    return {
      success: true,
      accounts,
    };
  }

  /**
   * Change account password (admin-initiated)
   */
  @Post('accounts/:id/password')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME, AccessLevel.HEAD)
  async changePassword(
    @Param('id') id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Get current account to check access level
    const currentAccount = await this.userService.findById(id);
    if (!currentAccount) {
      throw new Error('Account not found');
    }

    // Validate account management permission
    if (!currentAccount.accessLevel) {
      throw new Error('Account does not have an access level');
    }
    if (
      !canManageAccount(user.accessLevel || null, currentAccount.accessLevel)
    ) {
      throw new Error(
        "You do not have permission to change this account's password",
      );
    }

    await this.userService.changePassword(id, changePasswordDto.newPassword);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Change own password (self-service)
   */
  @Post('password/change')
  async changeOwnPassword(
    @Body() changeOwnPasswordDto: ChangeOwnPasswordDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.userService.changeOwnPassword(
      user.sub,
      changeOwnPasswordDto.currentPassword,
      changeOwnPasswordDto.newPassword,
    );

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  /**
   * Repair orphaned account
   */
  @Post('accounts/:id/repair')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
  async repairOrphanedAccount(
    @Param('id') id: string,
    @CurrentUser() _user: JwtPayload,
  ) {
    // Generate temporary password
    const tempPassword = this.generateRandomPassword();

    await this.userService.repairOrphanedAccount(id, tempPassword);

    return {
      success: true,
      message: 'Account repaired successfully',
      newPassword: tempPassword,
      note: 'Please save this password. The user can now log in and change their password.',
    };
  }

  /**
   * Generate random password
   */
  private generateRandomPassword(): string {
    const length = 16;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
