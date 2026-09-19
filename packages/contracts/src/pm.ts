import { z } from 'zod';

/** Project Management (see docs/PROJECT_MGMT.md). Two small status machines;
 *  tasks are assigned to team members (assigneeId → business membership). */
export const PROJECT_STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED'] as const;
export const ProjectStatusEnum = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED'] as const;
export const TaskStatusEnum = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof TaskStatusEnum>;

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const TaskPriorityEnum = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof TaskPriorityEnum>;

export const projectStatusLabel = (s: string): string =>
  ({ PLANNING: 'Planning', ACTIVE: 'Active', ON_HOLD: 'On hold', COMPLETED: 'Completed', CANCELLED: 'Cancelled', ARCHIVED: 'Archived' })[s] ?? s;
export const taskStatusLabel = (s: string): string =>
  ({ TODO: 'To do', IN_PROGRESS: 'In progress', IN_REVIEW: 'In review', DONE: 'Done', BLOCKED: 'Blocked', CANCELLED: 'Cancelled' })[s] ?? s;

const PROJECT_NEXT: Record<ProjectStatus, ProjectStatus[]> = {
  PLANNING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};
const TASK_NEXT: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'BLOCKED', 'CANCELLED'],
  IN_REVIEW: ['IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED'],
  DONE: ['IN_PROGRESS'],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CANCELLED'],
  CANCELLED: [],
};
export const allowedProjectTransitions = (s: ProjectStatus): ProjectStatus[] => PROJECT_NEXT[s];
export const allowedTaskTransitions = (s: TaskStatus): TaskStatus[] => TASK_NEXT[s];

// ---- projects ----

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  ownerId: z.string().uuid().optional(), // business membership id
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(2000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  status: ProjectStatusEnum.optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export const ProjectDto = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusEnum,
  ownerId: z.string().nullable(),
  ownerName: z.string().nullable(),
  taskCount: z.number().int(),
  openTaskCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ProjectDto = z.infer<typeof ProjectDto>;

export const ProjectListQuery = z.object({
  status: ProjectStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ProjectListQuery = z.infer<typeof ProjectListQuery>;

export const ProjectListResult = z.object({
  items: z.array(ProjectDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ProjectListResult = z.infer<typeof ProjectListResult>;

// ---- tasks ----

export const CreateTaskInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  priority: TaskPriorityEnum.default('MEDIUM'),
  assigneeId: z.string().uuid().optional(), // business membership id
  dueDate: z.string().datetime().optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  priority: TaskPriorityEnum.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: TaskStatusEnum.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const TaskDto = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskDto = z.infer<typeof TaskDto>;

export const TaskListQuery = z.object({
  projectId: z.string().optional(),
  status: TaskStatusEnum.optional(),
  assigneeId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
});
export type TaskListQuery = z.infer<typeof TaskListQuery>;

export const TaskListResult = z.object({
  items: z.array(TaskDto),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type TaskListResult = z.infer<typeof TaskListResult>;
