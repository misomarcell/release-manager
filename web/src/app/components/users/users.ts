import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { UsersService } from '../../services/users.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog';
import { extractHttpError } from '../../utils/http-error';
import type { UserInfo } from '@rm/shared/user.models';

@Component({
  selector: 'app-users',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, MatCardModule],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  private usersService = inject(UsersService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);

  protected users = signal<UserInfo[]>([]);
  protected loading = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    void this.loadUsers();
  }

  protected isSelf(user: UserInfo): boolean {
    return user.username === this.auth.username();
  }

  protected async toggleValid(user: UserInfo): Promise<void> {
    const newValid = !user.valid;
    const action = newValid ? 'enable' : 'disable';
    const confirmed = await this.confirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} user`,
      `Are you sure you want to ${action} ${user.username}?`,
    );
    if (!confirmed) return;

    try {
      await this.usersService.setUserValid(user.id, newValid);
      this.users.update((users) => users.map((u) => (u.id === user.id ? { ...u, valid: newValid } : u)));
    } catch (e: unknown) {
      this.error.set(extractHttpError(e, 'Failed to update user'));
    }
  }

  protected async deleteUser(user: UserInfo): Promise<void> {
    const confirmed = await this.confirm(
      'Delete user',
      `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await this.usersService.deleteUser(user.id);
      this.users.update((users) => users.filter((u) => u.id !== user.id));
    } catch (e: unknown) {
      this.error.set(extractHttpError(e, 'Failed to delete user'));
    }
  }

  protected async toggleAdmin(user: UserInfo): Promise<void> {
    const newAdmin = !user.admin;
    const action = newAdmin ? 'grant admin to' : 'revoke admin from';
    const confirmed = await this.confirm(
      `${newAdmin ? 'Grant' : 'Revoke'} admin`,
      `Are you sure you want to ${action} ${user.username}?`,
    );
    if (!confirmed) return;

    try {
      await this.usersService.setUserAdmin(user.id, newAdmin);
      this.users.update((users) => users.map((u) => (u.id === user.id ? { ...u, admin: newAdmin } : u)));
    } catch (e: unknown) {
      this.error.set(extractHttpError(e, 'Failed to update user'));
    }
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const users = await this.usersService.getUsers();
      this.users.set(users);
    } catch (e: unknown) {
      this.error.set(extractHttpError(e, 'Failed to load users'));
    } finally {
      this.loading.set(false);
    }
  }

  private async confirm(title: string, message: string): Promise<boolean> {
    const result = await firstValueFrom(
      this.dialog.open(ConfirmDialogComponent, { data: { title, message }, autoFocus: false }).afterClosed(),
    );
    return result === true;
  }
}
