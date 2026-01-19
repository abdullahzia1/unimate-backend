import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { HealthCheckResult, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<ApiResponse<HealthCheckResult>> {
    const result = await this.healthService.getHealth();
    return ApiResponse.success(result);
  }
}
