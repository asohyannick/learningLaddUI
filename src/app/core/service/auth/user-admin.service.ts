import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { UserRole } from '../../enum/global-enum-configuration';
import {
  ApiResponse,
  IBlockAccountRequest,
  IPageQuery,
  IPagedResponse,
  IUnBlockAccountRequest,
  IUserResponse,
  UUID,
} from '../../interface';

/**
 * The server caches user lists and profiles for up to 5 minutes, so a user we just blocked could
 * come back as "active" on the next page load. Changes made here are layered on top for that long.
 */
const SERVER_CACHE_MS = 5 * 60_000;

interface LocalChange {
  patch: Partial<IUserResponse>;
  at: number;
}

/**
 * Admin-only user management (`/auth/users`, ADMIN / SUPER_ADMIN / IT_ADMIN).
 * Deleting an account is in `AuthService.deleteAccount()`: the API only lets users delete their own.
 */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth/users`;

  private readonly changes = signal<ReadonlyMap<UUID, LocalChange>>(new Map());

  /** Read this in a `computed` to re-render when a user is blocked or unblocked. */
  readonly localChanges = this.changes.asReadonly();

  /** One page of users. Invalid values fall back to page 0, size 20, newest first. */
  listUsers(query: IPageQuery = {}): Observable<IPagedResponse<IUserResponse>> {
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) params[key] = value;
    }
    return this.http
      .get<ApiResponse<IPagedResponse<IUserResponse>>>(this.baseUrl, { params })
      .pipe(map((res) => res.data));
  }

  /** One non-deleted user. */
  getUser(userId: UUID): Observable<IUserResponse> {
    return this.http
      .get<ApiResponse<IUserResponse>>(`${this.baseUrl}/${encodeURIComponent(userId)}`)
      .pipe(map((res) => res.data));
  }

  /** Blocks the account, signs the user out and emails them the reason. Returns the API message. */
  blockUser(userId: UUID, body: IBlockAccountRequest): Observable<string> {
    return this.http
      .patch<ApiResponse<unknown>>(`${this.baseUrl}/${encodeURIComponent(userId)}/block`, body)
      .pipe(
        map((res) => res.message),
        tap(() => this.remember(userId, { isAccountBlocked: true })),
      );
  }

  /** Restores access (unverified users still have to verify their email). Returns the API message. */
  unblockUser(userId: UUID, body: IUnBlockAccountRequest): Observable<string> {
    return this.http
      .patch<ApiResponse<unknown>>(`${this.baseUrl}/${encodeURIComponent(userId)}/unblock`, body)
      .pipe(
        map((res) => res.message),
        tap(() => this.remember(userId, { isAccountBlocked: false })),
      );
  }

  /** The user with any recent block/unblock from this browser applied. */
  withLocalChanges(user: IUserResponse): IUserResponse {
    const change = this.changes().get(user.id);
    return change && Date.now() - change.at < SERVER_CACHE_MS ? { ...user, ...change.patch } : user;
  }

  private remember(userId: UUID, patch: Partial<IUserResponse>): void {
    const next = new Map(this.changes());
    next.set(userId, { patch, at: Date.now() });
    this.changes.set(next);
  }
}

// ─── Display helpers shared by the admin screens ─────────────────────────

export type AccountStatus = 'Active' | 'Blocked' | 'Unverified' | 'Deleted';

export function accountStatus(user: IUserResponse): AccountStatus {
  if (user.isAccountDeleted) return 'Deleted';
  if (user.isAccountBlocked) return 'Blocked';
  if (!user.isAccountVerified) return 'Unverified';
  return 'Active';
}

export const STATUS_BADGE: Record<AccountStatus, string> = {
  Active: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
  Blocked: 'bg-rose-400/10 text-rose-300 ring-rose-400/30',
  Unverified: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
  Deleted: 'bg-slate-400/10 text-slate-300 ring-slate-400/30',
};

export function displayName(user: Pick<IUserResponse, 'firstName' | 'lastName' | 'email'>): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email;
}

export function initials(user: Pick<IUserResponse, 'firstName' | 'lastName' | 'email'>): string {
  const first = user.firstName?.trim().charAt(0) ?? '';
  const last = user.lastName?.trim().charAt(0) ?? '';
  return (first + last || user.email.charAt(0)).toUpperCase();
}

/** Mirrors the server rules: admins cannot block themselves, super admins cannot be blocked. */
export function canBlock(user: IUserResponse, currentUserId: UUID | undefined): boolean {
  return (
    !user.isAccountBlocked &&
    !user.isAccountDeleted &&
    user.id !== currentUserId &&
    user.role !== UserRole.SUPER_ADMIN
  );
}

export function canUnblock(user: IUserResponse): boolean {
  return user.isAccountBlocked && !user.isAccountDeleted;
}

/** Why the block button is disabled, for its tooltip. */
export function blockDisabledReason(user: IUserResponse, currentUserId: UUID | undefined): string {
  if (user.id === currentUserId) return 'You cannot block your own account';
  if (user.role === UserRole.SUPER_ADMIN) return 'Super admin accounts cannot be blocked';
  if (user.isAccountDeleted) return 'This account is deleted';
  return '';
}
