import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatAccordion } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { LibraryCardComponent } from '../library-card/library-card';
import { LibraryService } from '../../services/library.service';
import { ActivatedRoute } from '@angular/router';
import type { LibraryItem } from '@rm/shared/jellyfin.models';

const PAGE_SIZE = 30;

@Component({
    selector: 'app-library',
    imports: [
        FormsModule,
        MatButtonModule,
        MatIconModule,
        MatAccordion,
        MatPaginatorModule,
        MatInputModule,
        MatFormFieldModule,
        LibraryCardComponent,
    ],
    templateUrl: './library.html',
    styleUrl: './library.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit {
    private libraryService = inject(LibraryService);
    private location = inject(Location);
    private route = inject(ActivatedRoute);

    protected loading = signal(false);
    protected error = signal<string | null>(null);
    protected items = signal<LibraryItem[]>([]);
    protected total = signal(0);
    protected currentPage = signal(1);
    protected jellyfinBaseUrl = signal('');
    protected searchQuery = signal('');
    protected activeSearch = signal('');
    protected readonly pageSize = PAGE_SIZE;
    protected readonly skeletonItems = [0, 1, 2, 3, 4];

    ngOnInit(): void {
        const params = this.route.snapshot.queryParams;
        if (params['q']) {
            this.searchQuery.set(params['q']);
            this.activeSearch.set(params['q']);
        }
        const page = parseInt(params['page'], 10);
        if (page > 0) {
            this.currentPage.set(page);
        }
        void this.loadItems();
    }

    protected onSearch(): void {
        this.activeSearch.set(this.searchQuery());
        this.currentPage.set(1);
        void this.loadItems();
    }

    protected clearSearch(): void {
        this.searchQuery.set('');
        this.activeSearch.set('');
        this.currentPage.set(1);
        void this.loadItems();
    }

    protected onPage(event: PageEvent): void {
        this.currentPage.set(event.pageIndex + 1);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        void this.loadItems();
    }

    private async loadItems(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);
        this.syncQueryParams();

        try {
            const response = await this.libraryService.getLibrary(
                this.searchQuery(),
                this.currentPage(),
                this.pageSize,
            );
            this.items.set(response.items);
            this.total.set(response.total);
            this.jellyfinBaseUrl.set(response.jellyfinBaseUrl);
        } catch (e: unknown) {
            this.error.set(e instanceof Error ? e.message : 'Failed to load library');
            this.items.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private syncQueryParams(): void {
        const params: Record<string, string> = {};
        if (this.searchQuery().trim()) params['q'] = this.searchQuery().trim();
        if (this.currentPage() > 1) params['page'] = String(this.currentPage());
        const qs = new URLSearchParams(params).toString();
        this.location.replaceState('/library', qs);
    }
}
