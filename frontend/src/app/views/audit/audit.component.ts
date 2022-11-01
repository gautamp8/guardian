import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { AuditService } from 'src/app/services/audit.service';
import { AuthService } from '../../services/auth.service';
import { forkJoin } from 'rxjs';
import { VCViewerDialog } from 'src/app/schema-engine/vc-dialog/vc-dialog.component';
import { PolicyEngineService } from 'src/app/services/policy-engine.service';
import { HttpResponse } from '@angular/common/http';

/**
 * Page with the list of VP Documents.
 */
@Component({
    selector: 'app-audit',
    templateUrl: './audit.component.html',
    styleUrls: ['./audit.component.css']
})
export class AuditComponent implements OnInit {
    loading: boolean = true;
    displayedColumns: string[] = [
        'policyId',
        'id',
        'hash',
        'owner',
        'createDate',
        'type',
        'vp',
    ];
    dataSource: any[] = [];
    policies: any[] = [];
    currentPolicy: any;
    pageIndex: number;
    pageSize: number;
    dataCount: any;

    constructor(
        private auth: AuthService,
        private auditService: AuditService,
        private route: ActivatedRoute,
        private router: Router,
        private policyEngineService: PolicyEngineService,
        public dialog: MatDialog
    ) {
        this.dataCount = 0;
        this.pageIndex = 0;
        this.pageSize = 25;
    }

    ngOnInit() {
        this.loading = true;
        this.loadData();
    }

    onFilter() {
        this.pageIndex = 0;
        this.router.navigate(['/audit'], {
            queryParams: {
                policyId: this.currentPolicy ? this.currentPolicy : ''
            }
        });
        this.loadVP();
    }

    onPage(event: any) {
        if (this.pageSize != event.pageSize) {
            this.pageIndex = 0;
            this.pageSize = event.pageSize;
        } else {
            this.pageIndex = event.pageIndex;
            this.pageSize = event.pageSize;
        }
        this.loadVP();
    }

    loadVP() {
        this.loading = true;
        this.auditService.getVpDocuments(this.currentPolicy, this.pageIndex, this.pageSize)
            .subscribe((dataResponse: HttpResponse<any[]>) => {
                this.dataSource = dataResponse.body || [];
                this.dataCount = dataResponse.headers.get('X-Total-Count') || this.dataSource.length;
                setTimeout(() => {
                    this.loading = false;
                }, 500);
            }, (e) => {
                console.error(e.error);
                this.loading = false;
            });
    }

    loadData() {
        this.loading = true;
        this.dataCount = 0;
        this.pageIndex = 0;
        this.pageSize = 25;
        this.currentPolicy = this.route.snapshot.queryParams['policyId'];
        forkJoin([
            this.policyEngineService.all(),
            this.auditService.getVpDocuments(this.currentPolicy, this.pageIndex, this.pageSize)
        ]).subscribe((value) => {
            const policies: any = value[0];
            const dataResponse: any = value[1];
            this.policies = policies;
            this.dataSource = dataResponse.body || [];
            this.dataCount = dataResponse.headers.get('X-Total-Count') || this.dataSource.length;
            setTimeout(() => {
                this.loading = false;
            }, 500);
        }, (error) => {
            this.loading = false;
            console.error(error);
        });
    }

    openVP(document: any) {
        const dialogRef = this.dialog.open(VCViewerDialog, {
            width: '850px',
            data: {
                document: document,
                title: 'VP',
                type: 'VP',
                viewDocument: true
            }
        });
        dialogRef.afterClosed().subscribe(async (result) => { });
    }

    setFilter(type: string, value: string) {
        if (type == 'policyId') {
            this.currentPolicy = value;
            this.router.navigate(['/audit'], { queryParams: { policyId: value } });
            this.onFilter();
        }
        if (type == 'id') {
            this.router.navigate(['/trust-chain'], { queryParams: { search: value } });
        }
        if (type == 'hash') {
            this.router.navigate(['/trust-chain'], { queryParams: { search: value } });
        }
    }
}
