import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Database } from './database';
import { Context } from './security';
import { Request, Response } from 'express';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { compare } from 'bcryptjs';
export interface AuthRequest extends Request {
  context: Context;
}
@Injectable()
export class AuthService {
  constructor(@Inject(Database) private db: Database) {}
  hash(token: string) {
    return createHmac('sha256', process.env.SESSION_SECRET!).update(token).digest('hex');
  }
  async login(email: string, password: string, res: Response) {
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user || !(await compare(password, user.passwordHash)))
      throw new UnauthorizedException('Email or password is incorrect.');
    const member = user.memberships[0];
    if (!member) throw new ForbiddenException('No organization membership.');
    const token = randomBytes(32).toString('base64url');
    await this.db.session.create({
      data: {
        id: this.hash(token),
        userId: user.id,
        organizationId: member.organizationId,
        expiresAt: new Date(Date.now() + 8 * 3600000),
      },
    });
    res.cookie('finsight_session', token, {
      httpOnly: true,
      secure: process.env.APP_BASE_URL?.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 8 * 3600000,
      path: '/',
    });
    return { name: user.name, role: member.role };
  }
  async resolve(req: AuthRequest) {
    const token = req.cookies?.finsight_session;
    if (!token) throw new UnauthorizedException('Please sign in.');
    const session = await this.db.session.findUnique({
      where: { id: this.hash(token) },
      include: { user: { include: { memberships: true, employees: true } } },
    });
    if (!session || session.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Your session has expired.');
    const member = session.user.memberships.find(
      (m) => m.organizationId === session.organizationId,
    );
    if (!member) throw new UnauthorizedException('Membership no longer exists.');
    return {
      userId: session.userId,
      organizationId: member.organizationId,
      role: member.role,
      departmentId: member.departmentId,
      employeeId:
        session.user.employees.find((e) => e.organizationId === member.organizationId)?.id || null,
      name: session.user.name,
    };
  }
  async logout(req: AuthRequest, res: Response) {
    const token = req.cookies?.finsight_session;
    if (token) await this.db.session.deleteMany({ where: { id: this.hash(token) } });
    res.clearCookie('finsight_session', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.APP_BASE_URL?.startsWith('https://'),
      path: '/',
    });
    return { ok: true };
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.context = await this.auth.resolve(req);
    return true;
  }
}
