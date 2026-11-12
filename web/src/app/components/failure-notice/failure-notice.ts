import { Component, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { FailureNotice } from '../../utils/failure-notice';

@Component({
    selector: 'app-failure-notice',
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './failure-notice.html',
    styleUrl: './failure-notice.scss',
})
export class FailureNoticeComponent {
    private document = inject(DOCUMENT);

    failures = input.required<FailureNotice[]>();

    protected reload(): void {
        this.document.location.reload();
    }
}
