import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiCookieAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import { Database } from './database';
import { AuthRequest, AuthService, SessionGuard } from './auth';
import { FinanceService } from './finance';
import { DocumentsService } from './documents';
import { CopilotService } from './copilot';
import { expenseSchema, moneySchema, monthSchema, requireRoles } from './security';
@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(Database) private db: Database,
  ) {}
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and create an HttpOnly session' })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const data = z
      .object({ email: z.email(), password: z.string().min(8).max(150) })
      .strict()
      .parse(body);
    return this.auth.login(data.email, data.password, res);
  }
  @Post('logout') @UseGuards(SessionGuard) logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.logout(req, res);
  }
  @Get('me') @UseGuards(SessionGuard) async me(@Req() req: AuthRequest) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: req.context.userId } });
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: req.context.organizationId },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: req.context.role,
      organization: org.name,
      departmentId: req.context.departmentId,
      employeeId: req.context.employeeId,
    };
  }
}
@ApiTags('Finance')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api')
export class FinanceController {
  constructor(
    @Inject(FinanceService) private finance: FinanceService,
    @Inject(Database) private db: Database,
    @Inject(DocumentsService) private docs: DocumentsService,
  ) {}
  @Get('departments') departments(@Req() r: AuthRequest) {
    return this.finance.departments(r.context);
  }
  @Get('dashboard') dashboard(
    @Req() r: AuthRequest,
    @Query('month') month = new Date().toISOString().slice(0, 7),
    @Query('department') dep?: string,
  ) {
    return this.finance.dashboard(r.context, monthSchema.parse(month), dep);
  }
  @Get('budgets') budgets(
    @Req() r: AuthRequest,
    @Query('month') month = new Date().toISOString().slice(0, 7),
    @Query('department') dep?: string,
  ) {
    return this.finance.budgets(r.context, monthSchema.parse(month), dep);
  }
  @Post('budgets') allocate(@Req() r: AuthRequest, @Body() body: unknown) {
    const data = z
      .object({
        departmentId: z.string(),
        month: monthSchema,
        amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/),
        category: z
          .enum(['ALL', 'Travel', 'Software', 'Operations', 'Marketing', 'Salary'])
          .optional(),
      })
      .strict()
      .parse(body);
    return this.finance.allocate(r.context, data);
  }
  @Get('budgets/:id/history') async budgetHistory(@Req() r: AuthRequest, @Param('id') id: string) {
    requireRoles(r.context, ['ADMIN', 'FINANCE', 'AUDITOR']);
    const budget = await this.db.budget.findFirst({
      where: { id, organizationId: r.context.organizationId },
      include: { history: { orderBy: { createdAt: 'desc' } } },
    });
    if (!budget) throw new NotFoundException('Budget not found.');
    return budget.history;
  }
  @Get('expenses') expenses(
    @Req() r: AuthRequest,
    @Query('month') month = new Date().toISOString().slice(0, 7),
    @Query('department') dep?: string,
  ) {
    return this.finance.expenses(r.context, monthSchema.parse(month), dep);
  }
  @Post('expenses') submit(@Req() r: AuthRequest, @Body() body: unknown) {
    const clean = { ...(body as object) };
    delete (clean as any).receipt;
    return this.finance.submit(r.context, expenseSchema.parse(clean));
  }
  @Get('expenses/:id') expense(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.finance.detail(r.context, id);
  }
  @Post('expenses/:id/receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  receipt(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.docs.receipt(r.context, id, file);
  }
  @Get('expenses/:id/receipts') receipts(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.receipts(r.context, id);
  }
  @Post('expenses/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  attachment(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.docs.receipt(r.context, id, file, 'SUPPORTING');
  }
  @Get('expenses/:id/attachments') attachments(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.attachments(r.context, id);
  }
  @Patch('expenses/:id') review(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = z
      .object({ status: z.enum(['APPROVED', 'REJECTED']) })
      .strict()
      .parse(body);
    return this.finance.review(r.context, id, data.status);
  }
  @Post('expenses/:id/comments') comment(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.finance.comment(
      r.context,
      id,
      z
        .object({ text: z.string().min(1).max(2000) })
        .strict()
        .parse(body).text,
    );
  }
  @Get('audit') audit(@Req() r: AuthRequest) {
    return this.finance.findings(r.context);
  }
  @Patch('audit/:id') updateAudit(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.finance.updateFinding(
      r.context,
      id,
      z
        .object({ status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']) })
        .strict()
        .parse(body).status,
    );
  }
  @Patch('settings/profile') async profile(@Req() r: AuthRequest, @Body() body: unknown) {
    const data = z
      .object({ name: z.string().min(2).max(80) })
      .strict()
      .parse(body);
    const user = await this.db.user.update({ where: { id: r.context.userId }, data });
    return { name: user.name, email: user.email };
  }
  @Get('users') users(@Req() r: AuthRequest) {
    requireRoles(r.context, ['ADMIN']);
    return this.db.membership.findMany({
      where: { organizationId: r.context.organizationId },
      select: {
        id: true,
        role: true,
        departmentId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }
  @Post('users') async createUser(@Req() r: AuthRequest, @Body() body: unknown) {
    requireRoles(r.context, ['ADMIN']);
    const data = z
      .object({
        name: z.string().min(2),
        email: z.email(),
        password: z.string().min(12).max(150),
        role: z.enum(['ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR', 'EMPLOYEE']),
        departmentId: z.string().optional(),
      })
      .strict()
      .parse(body);
    if (['MANAGER', 'EMPLOYEE'].includes(data.role) && !data.departmentId)
      throw new BadRequestException('A department is required.');
    if (
      data.departmentId &&
      !(await this.db.department.findFirst({
        where: { id: data.departmentId, organizationId: r.context.organizationId },
      }))
    )
      throw new BadRequestException('Invalid department.');
    const user = await this.db.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await hash(data.password, 12),
        memberships: {
          create: {
            organizationId: r.context.organizationId,
            role: data.role,
            departmentId: data.departmentId,
          },
        },
        ...(data.departmentId
          ? {
              employees: {
                create: {
                  organizationId: r.context.organizationId,
                  departmentId: data.departmentId,
                  name: data.name,
                },
              },
            }
          : {}),
      },
      select: { id: true, name: true, email: true },
    });
    await this.finance.log(r.context, 'USER_CREATED', user.id);
    return user;
  }
  @Post('departments') async createDepartment(@Req() r: AuthRequest, @Body() body: unknown) {
    requireRoles(r.context, ['ADMIN']);
    const data = z
      .object({ name: z.string().min(2).max(80) })
      .strict()
      .parse(body);
    return this.db.department.create({
      data: { ...data, organizationId: r.context.organizationId },
    });
  }
  @Post('accounting/journals') journal(@Req() r: AuthRequest, @Body() body: unknown) {
    const nonnegative = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
    const data = z
      .object({
        description: z.string().min(3).max(200),
        date: z.iso.date(),
        lines: z
          .array(z.object({ accountId: z.string(), debit: nonnegative, credit: nonnegative }))
          .min(2)
          .max(100),
      })
      .strict()
      .parse(body);
    return this.finance.ledger(r.context, data);
  }
  @Post('imports/expenses')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  async importExpenses(@Req() r: AuthRequest, @UploadedFile() file: Express.Multer.File) {
    requireRoles(r.context, ['ADMIN', 'FINANCE']);
    if (!file || !file.originalname.toLowerCase().endsWith('.csv'))
      throw new BadRequestException('Upload an expense CSV under 2 MB.');
    let rows: any[];
    try {
      rows = parse(file.buffer, { columns: true, skip_empty_lines: true, max_record_size: 10000 });
    } catch {
      throw new BadRequestException('Invalid CSV.');
    }
    if (rows.length > 500) throw new BadRequestException('Import at most 500 rows at once.');
    const schema = expenseSchema.extend({ employeeId: z.string().min(1) });
    const checked = rows.map((row) => schema.parse(row));
    const employees = await this.db.employee.findMany({
      where: { organizationId: r.context.organizationId },
    });
    if (
      checked.some(
        (row) =>
          !employees.some((e) => e.id === row.employeeId && e.departmentId === row.departmentId),
      )
    )
      throw new BadRequestException(
        'Every employee must belong to the specified department and your organization.',
      );
    await this.db.$transaction(
      checked.map((row) =>
        this.db.expense.create({
          data: {
            ...row,
            date: new Date(row.date),
            organizationId: r.context.organizationId,
            status: 'PENDING',
            flags: {
              create: {
                rule: 'MISSING_RECEIPT',
                severity: 'Medium',
                explanation: 'CSV import contains no supporting receipt.',
              },
            },
          },
        }),
      ),
    );
    await this.finance.log(r.context, 'EXPENSE_CSV_IMPORTED', `${checked.length} records`);
    return { imported: checked.length };
  }
}
@ApiTags('Knowledge')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api/documents')
export class DocumentsController {
  constructor(@Inject(DocumentsService) private docs: DocumentsService) {}
  @Get() list(@Req() r: AuthRequest) {
    return this.docs.list(r.context);
  }
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @Req() r: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
    @Body('departmentId') dep?: string,
  ) {
    return this.docs.upload(r.context, file, dep);
  }
  @Get(':id') async get(@Req() r: AuthRequest, @Param('id') id: string) {
    const d = await this.docs.get(r.context, id);
    return {
      id: d.id,
      title: d.title,
      passage: d.chunks.map((c) => c.content).join('\n\n') || d.content || '',
      status: d.status,
      model: d.model,
      dimensions: d.dimensions,
    };
  }
  @Get(':id/preview') preview(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.preview(r.context, id);
  }
  @Post(':id/reindex') reindex(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.reindex(r.context, id);
  }
  @Post(':id/approve') approve(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.approve(r.context, id);
  }
  @Delete(':id') remove(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.docs.remove(r.context, id);
  }
}
@ApiTags('Copilot')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('api')
export class CopilotController {
  constructor(@Inject(CopilotService) private copilot: CopilotService) {}
  @Post('copilot') ask(@Req() r: AuthRequest, @Body() body: unknown) {
    const data = z
      .object({ question: z.string().min(2).max(2000), conversationId: z.string().optional() })
      .strict()
      .parse(body);
    return this.copilot.ask(r.context, data.question, data.conversationId);
  }
  @Get('conversations') list(@Req() r: AuthRequest) {
    return this.copilot.conversations(r.context);
  }
  @Get('conversations/:id') messages(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.copilot.messages(r.context, id);
  }
  @Delete('conversations/:id') remove(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.copilot.remove(r.context, id);
  }
}
