import { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, GridApi } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { Download, Search } from 'lucide-react';
import { fetchAgentTokens, fetchAgentRequests, fetchOwnerAuditEntries } from '@/lib/agentApi';
import { formatCurrency, formatDateTime } from '@/lib/format';

interface LedgerRow {
  id: string;
  occurredAt: string;
  stage: string;
  actor: string;
  reference: string;
  amountCents: number | null;
  detail: string;
}

const REQUEST_STAGE: Record<string, string> = {
  pending_approval: 'Payment Requested',
  approved: 'Owner Approved',
  declined: 'Owner Declined',
  blocked: 'Blocked by Guardrails',
};

const columnDefs: ColDef<LedgerRow>[] = [
  {
    field: 'occurredAt',
    headerName: 'Time',
    sort: 'asc',
    minWidth: 170,
    valueFormatter: (p) => (p.value ? formatDateTime(p.value) : ''),
  },
  { field: 'stage', headerName: 'Stage', minWidth: 210 },
  { field: 'actor', headerName: 'Actor', minWidth: 110 },
  { field: 'reference', headerName: 'Vendor / Token', minWidth: 170 },
  {
    field: 'amountCents',
    headerName: 'Amount',
    minWidth: 120,
    type: 'numericColumn',
    valueFormatter: (p) => (p.value == null ? '' : formatCurrency(p.value)),
  },
  { field: 'detail', headerName: 'Detail', flex: 1, minWidth: 260 },
];

export default function AuditLedger() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const gridRef = useRef<AgGridReact<LedgerRow>>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tokens, requests, entries] = await Promise.all([
          fetchAgentTokens(),
          fetchAgentRequests(),
          fetchOwnerAuditEntries(),
        ]);
        const tokenLabel = new Map(tokens.map((t) => [t.id, t.label]));
        const merged: LedgerRow[] = [
          ...tokens.map((t) => ({
            id: `token-${t.id}`,
            occurredAt: t.created_at,
            stage: 'Token Created',
            actor: 'Owner',
            reference: t.label,
            amountCents: null,
            detail: `Valid until ${formatDateTime(t.expires_at)}. Merchants: ${t.merchant_whitelist.join(', ') || 'none'}`,
          })),
          ...requests.map((r) => ({
            id: `request-${r.id}`,
            occurredAt: r.created_at,
            stage: REQUEST_STAGE[r.status] ?? r.status,
            actor: 'Agent',
            reference: r.vendor_name,
            amountCents: r.amount_cents,
            detail: r.block_reason ?? `Cited: ${r.source_context}`,
          })),
          ...entries.map((e) => ({
            id: `audit-${e.id}`,
            occurredAt: e.created_at,
            stage: e.title,
            actor: e.actor,
            reference: e.trade_name ?? tokenLabel.get(String(e.metadata.token_id)) ?? '',
            amountCents: typeof e.metadata.amount_cents === 'number' ? e.metadata.amount_cents : null,
            detail: e.detail ?? '',
          })),
        ];
        merged.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
        setRows(merged);
      } catch {
        setError('Could not load the audit ledger. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    []
  );

  function exportCsv() {
    const api: GridApi<LedgerRow> | undefined = gridRef.current?.api;
    api?.exportDataAsCsv({ fileName: 'agentpay-audit-ledger.csv' });
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">Audit Ledger</h1>
          <p className="text-sm text-ink-500 mt-1">
            Every step from token creation to final payment capture, in order. Sort, filter, or download it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={quickFilter}
              onChange={(e) => setQuickFilter(e.target.value)}
              placeholder="Search the ledger"
              className="pl-9 pr-3 py-2.5 rounded-xl border border-base-200 text-sm text-ink-900 bg-white focus:outline-none focus:ring-2 focus:ring-rail-400"
            />
          </div>
          <button
            onClick={exportCsv}
            disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rail-600 text-white text-sm font-semibold hover:bg-rail-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-ember-600">{error}</p>}

      <div className="ag-theme-quartz rounded-2xl overflow-hidden border border-base-200" style={{ height: 560 }}>
        <AgGridReact<LedgerRow>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          loading={loading}
          pagination
          paginationPageSize={25}
          getRowId={(p) => p.data.id}
          overlayNoRowsTemplate="<span>No ledger entries yet.</span>"
        />
      </div>
    </div>
  );
}
