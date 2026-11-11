import { Component, input } from '@angular/core';
import { AccountMenuComponent } from '../account-menu/account-menu';

@Component({
    selector: 'app-page-title',
    imports: [AccountMenuComponent],
    templateUrl: './page-title.html',
    styleUrl: './page-title.scss',
})
export class PageTitleComponent {
    title = input.required<string>();
}
