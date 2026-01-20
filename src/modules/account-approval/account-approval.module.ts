import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingAccount } from '../../database/entities/pending-account.entity';
import { User } from '../../database/entities/user.entity';
import { AccountApprovalController } from './account-approval.controller';
import { AccountApprovalService } from './account-approval.service';

@Module({
  imports: [TypeOrmModule.forFeature([PendingAccount, User])],
  controllers: [AccountApprovalController],
  providers: [AccountApprovalService],
  exports: [AccountApprovalService],
})
export class AccountApprovalModule {}
