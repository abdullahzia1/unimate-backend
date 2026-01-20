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
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentService } from './department.service';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  /**
   * Create department
   */
  @Post()
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
  async createDepartment(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const id = await this.departmentService.createDepartment(
      createDepartmentDto,
      user.sub,
    );

    return {
      success: true,
      message: 'Department created successfully',
      id,
    };
  }

  /**
   * Get departments
   */
  @Get()
  async getDepartments() {
    const departments = await this.departmentService.getDepartments();

    return {
      success: true,
      departments,
    };
  }

  /**
   * Update department
   */
  @Put(':id')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
  async updateDepartment(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.departmentService.updateDepartment(
      id,
      updateDepartmentDto,
      user.sub,
    );

    return {
      success: true,
      message: 'Department updated successfully',
    };
  }

  /**
   * Delete department
   */
  @Delete(':id')
  @UseGuards(AccessLevelGuard)
  @RequireAccessLevel(AccessLevel.SUPER, AccessLevel.SUPREME)
  async deleteDepartment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.departmentService.deleteDepartment(id, user.sub);

    return {
      success: true,
      message: 'Department deleted successfully',
    };
  }
}
