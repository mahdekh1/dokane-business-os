import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateProjectInput,
  CreateTaskInput,
  ProjectListQuery,
  TaskListQuery,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@dokane/contracts';
import type {
  CreateProjectInput as CreateProjectInputType,
  CreateTaskInput as CreateTaskInputType,
  ProjectDto,
  ProjectListQuery as ProjectListQueryType,
  ProjectListResult,
  TaskDto,
  TaskListQuery as TaskListQueryType,
  TaskListResult,
  UpdateProjectInput as UpdateProjectInputType,
  UpdateTaskInput as UpdateTaskInputType,
} from '@dokane/contracts';
import { Ctx, RequireEntitlement, RequirePermission } from '../../common/decorators';
import type { TenantContext } from '../../common/tenant-context';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PmService } from './pm.service';

@Controller('pm')
@RequireEntitlement('project_management')
export class PmController {
  constructor(private readonly pm: PmService) {}

  @RequirePermission('pm.projects.view')
  @Get('projects')
  listProjects(@Ctx() ctx: TenantContext, @Query(new ZodValidationPipe(ProjectListQuery)) q: ProjectListQueryType): Promise<ProjectListResult> {
    return this.pm.listProjects(ctx, q);
  }

  @RequirePermission('pm.projects.view')
  @Get('projects/:id')
  getProject(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<ProjectDto> {
    return this.pm.getProject(ctx, id);
  }

  @RequirePermission('pm.projects.create')
  @Post('projects')
  createProject(@Ctx() ctx: TenantContext, @Body(new ZodValidationPipe(CreateProjectInput)) body: CreateProjectInputType): Promise<ProjectDto> {
    return this.pm.createProject(ctx, body);
  }

  @RequirePermission('pm.projects.update')
  @Patch('projects/:id')
  updateProject(@Ctx() ctx: TenantContext, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateProjectInput)) body: UpdateProjectInputType): Promise<ProjectDto> {
    return this.pm.updateProject(ctx, id, body);
  }

  @RequirePermission('pm.tasks.view')
  @Get('tasks')
  listTasks(@Ctx() ctx: TenantContext, @Query(new ZodValidationPipe(TaskListQuery)) q: TaskListQueryType): Promise<TaskListResult> {
    return this.pm.listTasks(ctx, q);
  }

  @RequirePermission('pm.tasks.view')
  @Get('tasks/:id')
  getTask(@Ctx() ctx: TenantContext, @Param('id') id: string): Promise<TaskDto> {
    return this.pm.getTask(ctx, id);
  }

  @RequirePermission('pm.tasks.create')
  @Post('tasks')
  createTask(@Ctx() ctx: TenantContext, @Body(new ZodValidationPipe(CreateTaskInput)) body: CreateTaskInputType): Promise<TaskDto> {
    return this.pm.createTask(ctx, body);
  }

  @RequirePermission('pm.tasks.update')
  @Patch('tasks/:id')
  updateTask(@Ctx() ctx: TenantContext, @Param('id') id: string, @Body(new ZodValidationPipe(UpdateTaskInput)) body: UpdateTaskInputType): Promise<TaskDto> {
    return this.pm.updateTask(ctx, id, body);
  }
}
