import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  allowedProjectTransitions,
  allowedTaskTransitions,
  type CreateProjectInput,
  type CreateTaskInput,
  type ProjectDto,
  type ProjectListQuery,
  type ProjectListResult,
  type ProjectStatus,
  type TaskDto,
  type TaskListQuery,
  type TaskListResult,
  type TaskStatus,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from '@dokane/contracts';
import type { Prisma, Project, Task } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBus } from '../../common/events/event-bus.service';
import type { TenantContext } from '../../common/tenant-context';

@Injectable()
export class PmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  // ---- projects ----

  async listProjects(ctx: TenantContext, query: ProjectListQuery): Promise<ProjectListResult> {
    const where: Prisma.ProjectWhereInput = {
      businessId: ctx.businessId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.project.count({ where }),
    ]);
    const counts = await this.taskCounts(ctx.businessId, rows.map((p) => p.id));
    const names = await this.memberNames(ctx.businessId, rows.map((p) => p.ownerId));
    return {
      items: rows.map((p) => this.projectDto(p, counts.get(p.id), names)),
      total, page: query.page, pageSize: query.pageSize,
    };
  }

  async getProject(ctx: TenantContext, id: string): Promise<ProjectDto> {
    const p = await this.prisma.project.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!p) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND' });
    const counts = await this.taskCounts(ctx.businessId, [p.id]);
    const names = await this.memberNames(ctx.businessId, [p.ownerId]);
    return this.projectDto(p, counts.get(p.id), names);
  }

  async createProject(ctx: TenantContext, input: CreateProjectInput): Promise<ProjectDto> {
    if (input.ownerId) await this.assertMembership(ctx.businessId, input.ownerId);
    const p = await this.prisma.project.create({
      data: { businessId: ctx.businessId, name: input.name, description: input.description ?? null, ownerId: input.ownerId ?? null },
    });
    return this.getProject(ctx, p.id);
  }

  async updateProject(ctx: TenantContext, id: string, input: UpdateProjectInput): Promise<ProjectDto> {
    const existing = await this.prisma.project.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!existing) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND' });
    if (input.ownerId) await this.assertMembership(ctx.businessId, input.ownerId);
    if (input.status && input.status !== existing.status) {
      const allowed = allowedProjectTransitions(existing.status as ProjectStatus);
      if (!allowed.includes(input.status)) throw new BadRequestException({ code: 'ILLEGAL_TRANSITION', message: `Cannot move project from ${existing.status} to ${input.status}.` });
    }
    const data: Prisma.ProjectUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.ownerId !== undefined) data.ownerId = input.ownerId;
    if (input.status !== undefined) data.status = input.status;
    await this.prisma.project.update({ where: { id }, data });
    return this.getProject(ctx, id);
  }

  // ---- tasks ----

  async listTasks(ctx: TenantContext, query: TaskListQuery): Promise<TaskListResult> {
    const where: Prisma.TaskWhereInput = {
      businessId: ctx.businessId,
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.task.count({ where }),
    ]);
    const names = await this.memberNames(ctx.businessId, rows.map((t) => t.assigneeId));
    return { items: rows.map((t) => this.taskDto(t, names)), total, page: query.page, pageSize: query.pageSize };
  }

  async getTask(ctx: TenantContext, id: string): Promise<TaskDto> {
    const t = await this.prisma.task.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!t) throw new NotFoundException({ code: 'TASK_NOT_FOUND' });
    const names = await this.memberNames(ctx.businessId, [t.assigneeId]);
    return this.taskDto(t, names);
  }

  async createTask(ctx: TenantContext, input: CreateTaskInput): Promise<TaskDto> {
    const project = await this.prisma.project.findFirst({ where: { id: input.projectId, businessId: ctx.businessId }, select: { id: true } });
    if (!project) throw new BadRequestException({ code: 'PROJECT_NOT_FOUND', message: 'Unknown project.' });
    if (input.assigneeId) await this.assertMembership(ctx.businessId, input.assigneeId);

    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          businessId: ctx.businessId,
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'MEDIUM',
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      });
      if (t.assigneeId) await this.emitAssigned(tx, t);
      return t;
    });
    return this.getTask(ctx, task.id);
  }

  async updateTask(ctx: TenantContext, id: string, input: UpdateTaskInput): Promise<TaskDto> {
    const existing = await this.prisma.task.findFirst({ where: { id, businessId: ctx.businessId } });
    if (!existing) throw new NotFoundException({ code: 'TASK_NOT_FOUND' });
    if (input.assigneeId) await this.assertMembership(ctx.businessId, input.assigneeId);
    if (input.status && input.status !== existing.status) {
      const allowed = allowedTaskTransitions(existing.status as TaskStatus);
      if (!allowed.includes(input.status)) throw new BadRequestException({ code: 'ILLEGAL_TRANSITION', message: `Cannot move task from ${existing.status} to ${input.status}.` });
    }

    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.status !== undefined) data.status = input.status;

    const reassigned = input.assigneeId !== undefined && input.assigneeId && input.assigneeId !== existing.assigneeId;
    const completed = input.status === 'DONE' && existing.status !== 'DONE';

    await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({ where: { id }, data });
      if (reassigned) await this.emitAssigned(tx, t);
      if (completed) await this.events.emit(tx, 'pm.task.completed', { taskId: t.id, businessId: ctx.businessId, projectId: t.projectId, title: t.title, assigneeId: t.assigneeId });
    });
    return this.getTask(ctx, id);
  }

  // ---- helpers ----

  private async emitAssigned(tx: Prisma.TransactionClient, t: Task): Promise<void> {
    await this.events.emit(tx, 'pm.task.assigned', { taskId: t.id, businessId: t.businessId, projectId: t.projectId, assigneeId: t.assigneeId, title: t.title });
  }

  private projectDto(p: Project, counts: { total: number; open: number } | undefined, names: Map<string, string>): ProjectDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status as ProjectStatus,
      ownerId: p.ownerId,
      ownerName: p.ownerId ? names.get(p.ownerId) ?? null : null,
      taskCount: counts?.total ?? 0,
      openTaskCount: counts?.open ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private taskDto(t: Task, names: Map<string, string>): TaskDto {
    return {
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      status: t.status as TaskStatus,
      priority: t.priority as TaskDto['priority'],
      assigneeId: t.assigneeId,
      assigneeName: t.assigneeId ? names.get(t.assigneeId) ?? null : null,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private async assertMembership(businessId: string, membershipId: string): Promise<void> {
    const m = await this.prisma.businessMembership.findFirst({ where: { id: membershipId, businessId }, select: { id: true } });
    if (!m) throw new BadRequestException({ code: 'INVALID_ASSIGNEE', message: 'Assignee is not a member of this business.' });
  }

  private async taskCounts(businessId: string, projectIds: string[]): Promise<Map<string, { total: number; open: number }>> {
    const map = new Map<string, { total: number; open: number }>();
    if (projectIds.length === 0) return map;
    const [totals, opens] = await Promise.all([
      this.prisma.task.groupBy({ by: ['projectId'], where: { businessId, projectId: { in: projectIds } }, _count: { _all: true } }),
      this.prisma.task.groupBy({ by: ['projectId'], where: { businessId, projectId: { in: projectIds }, status: { notIn: ['DONE', 'CANCELLED'] } }, _count: { _all: true } }),
    ]);
    for (const id of projectIds) map.set(id, { total: 0, open: 0 });
    for (const r of totals) map.set(r.projectId, { total: r._count._all, open: map.get(r.projectId)?.open ?? 0 });
    for (const r of opens) map.set(r.projectId, { total: map.get(r.projectId)?.total ?? 0, open: r._count._all });
    return map;
  }

  private async memberNames(businessId: string, ids: (string | null)[]): Promise<Map<string, string>> {
    const uniq = [...new Set(ids.filter((x): x is string => !!x))];
    if (uniq.length === 0) return new Map();
    const rows = await this.prisma.businessMembership.findMany({
      where: { businessId, id: { in: uniq } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    });
    return new Map(rows.map((m) => [m.id, `${m.user.firstName} ${m.user.lastName}`.trim()]));
  }
}
