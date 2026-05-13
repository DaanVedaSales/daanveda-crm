'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import { formatDate } from '@/lib/utils'
import { Upload, Plus, FileText, Table2, X, Download } from 'lucide-react'
import type { Dataset } from '@/types/database'

// The 24 database fields we accept in uploads
const DB_FIELDS = [
  // ── Organisation ─────────────────────────────────────
  { value: 'name',             label: 'Org Name',           required: true },
  { value: 'sql_score_label',  label: 'SQL Score' },
  { value: 'url',              label: 'Org Website' },
  { value: 'location',         label: 'Location' },
  { value: 'annual_revenue',   label: 'Annual Revenue (₹)' },
  { value: 'team_size',        label: 'Team Size' },
  { value: 'age_years',        label: 'Age (years)' },
  { value: 'thematic_areas',   label: 'Thematic Areas' },
  { value: 'linkedin_url',     label: 'Org LinkedIn' },
  // ── Primary KDM ──────────────────────────────────────
  { value: 'kdm_name',         label: 'KDM1 Name' },
  { value: 'kdm_phone',        label: 'KDM1 Phone' },
  { value: 'kdm_email',        label: 'KDM1 Email' },
  { value: 'kdm_designation',  label: 'KDM1 Designation' },
  { value: 'kdm_linkedin',     label: 'KDM1 LinkedIn' },
  // ── Secondary KDM ────────────────────────────────────
  { value: 'kdm2_name',        label: 'KDM2 Name' },
  { value: 'kdm2_phone',       label: 'KDM2 Phone' },
  { value: 'kdm2_email',       label: 'KDM2 Email' },
  { value: 'kdm2_designation', label: 'KDM2 Designation' },
  { value: 'kdm2_linkedin',    label: 'KDM2 LinkedIn' },
  // ── Tertiary KDM ─────────────────────────────────────
  { value: 'kdm3_name',        label: 'KDM3 Name' },
  { value: 'kdm3_phone',       label: 'KDM3 Phone' },
  { value: 'kdm3_email',       label: 'KDM3 Email' },
  { value: 'kdm3_designation', label: 'KDM3 Designation' },
  { value: 'kdm3_linkedin',    label: 'KDM3 LinkedIn' },
]

const SAMPLE_CSV = `name,sql_score,url,location,annual_revenue,team_size,age_years,thematic_areas,linkedin_url,kdm_name,kdm_phone,kdm_email,kdm_designation,kdm_linkedin,kdm2_name,kdm2_phone,kdm2_email,kdm2_designation,kdm2_linkedin,kdm3_name,kdm3_phone,kdm3_email,kdm3_designation,kdm3_linkedin
Greenpeace India,High,https://greenpeace.in,Mumbai,5000000,25,8,"Environment, Climate",https://linkedin.com/company/greenpeace-india,Ravi Kumar,9876543210,ravi@greenpeace.in,Director,https://linkedin.com/in/ravikumar,Sunita Rao,9988776655,sunita@greenpeace.in,Manager,https://linkedin.com/in/sunitarao,,,,,
CRY India,Medium,https://cry.org,Delhi,8000000,40,30,"Child Rights, Education",https://linkedin.com/company/cry-india,Priya Sharma,9123456789,priya@cry.org,Head of Partnerships,https://linkedin.com/in/priyasharma,,,,,,,,,`

// ── CSV Parser (handles commas inside quoted fields) ──────────────────────────
function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

// Auto-map CSV headers to DB fields
function autoMapHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  headers.forEach(h => {
    const norm = h.toLowerCase().replace(/[\s_-]+/g, '_')
    const match = DB_FIELDS.find(f => {
      const fNorm = f.value.toLowerCase()
      const lNorm = f.label.toLowerCase().replace(/[\s()\-₹]+/g, '_')
      return fNorm === norm || lNorm.includes(norm) || norm.includes(fNorm.split('_')[0])
    })
    if (match) map[h] = match.value
  })
  return map
}

// ── Spreadsheet Paste Grid ────────────────────────────────────────────────────
const DEFAULT_COLS = DB_FIELDS.length  // always matches the number of DB fields (24)
const DEFAULT_ROWS = 100

function PasteGrid({
  onRowsReady,
}: {
  onRowsReady: (rows: Record<string, string>[]) => void
}) {
  const colCount = DEFAULT_COLS
  const [headers, setHeaders] = useState<string[]>(Array(DEFAULT_COLS).fill(''))
  const [cells, setCells] = useState<string[][]>(
    Array(DEFAULT_ROWS).fill(null).map(() => Array(DEFAULT_COLS).fill(''))
  )
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const lastSelectedRow = useRef<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Row number click: toggle / shift-range select ─────────────────────────
  function handleRowNumberClick(ri: number, e: React.MouseEvent) {
    if (e.shiftKey && lastSelectedRow.current !== null) {
      const from = Math.min(lastSelectedRow.current, ri)
      const to   = Math.max(lastSelectedRow.current, ri)
      setSelectedRows(prev => {
        const next = new Set(prev)
        for (let r = from; r <= to; r++) next.add(r)
        return next
      })
    } else {
      setSelectedRows(prev => {
        const next = new Set(prev)
        next.has(ri) ? next.delete(ri) : next.add(ri)
        return next
      })
      lastSelectedRow.current = ri
    }
  }

  // ── Keyboard shortcuts on the grid container ──────────────────────────────
  function handleGridKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod   = isMac ? e.metaKey : e.ctrlKey

    // Delete / Backspace — clear selected rows
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRows.size > 0) {
      // Only fire if focus is NOT inside an input (let inputs handle their own delete)
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      e.preventDefault()
      setCells(prev => {
        const next = prev.map(r => [...r])
        selectedRows.forEach(ri => { next[ri] = Array(colCount).fill('') })
        return next
      })
      return
    }

    if (!mod) return

    // Cmd/Ctrl+C — copy selected rows as TSV
    if (e.key === 'c' && selectedRows.size > 0) {
      e.preventDefault()
      const tsv = [...selectedRows].sort((a, b) => a - b)
        .map(ri => cells[ri].join('\t'))
        .join('\n')
      navigator.clipboard.writeText(tsv).catch(() => {})
      return
    }

    // Cmd/Ctrl+X — cut: copy then clear
    if (e.key === 'x' && selectedRows.size > 0) {
      e.preventDefault()
      const tsv = [...selectedRows].sort((a, b) => a - b)
        .map(ri => cells[ri].join('\t'))
        .join('\n')
      navigator.clipboard.writeText(tsv).catch(() => {})
      setCells(prev => {
        const next = prev.map(r => [...r])
        selectedRows.forEach(ri => { next[ri] = Array(colCount).fill('') })
        return next
      })
      return
    }

    // Cmd/Ctrl+V — paste clipboard starting at first selected row (or row 0)
    if (e.key === 'v') {
      e.preventDefault()
      const startRow = selectedRows.size > 0
        ? Math.min(...selectedRows)
        : 0
      navigator.clipboard.readText().then(text => {
        const pastedRows = text.split('\n').map(r => r.split('\t'))
        setCells(prev => {
          const next = prev.map(r => [...r])
          pastedRows.forEach((row, ri) => {
            row.forEach((val, ci) => {
              const tr = startRow + ri
              const tc = ci
              if (tr < next.length && tc < colCount) {
                next[tr][tc] = val.trim().replace(/\r/g, '')
              }
            })
          })
          return next
        })
      }).catch(() => {})
      return
    }
  }

  // ── Per-cell paste (Excel copy→paste directly into a cell) ────────────────
  function handleCellPaste(e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) {
    // If rows are selected and paste target isn't in a selected row, use regular cell paste
    // Otherwise fall through to normal single-cell paste
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').filter(l => l !== '')
    if (lines.length <= 1 && !text.includes('\t')) return // single value, let input handle it
    e.preventDefault()
    const pastedRows = lines.map(r => r.split('\t'))
    setCells(prev => {
      const next = prev.map(r => [...r])
      pastedRows.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const tr = startRow + ri
          const tc = startCol + ci
          if (tr < next.length && tc < colCount) {
            next[tr][tc] = val.trim().replace(/\r/g, '')
          }
        })
      })
      return next
    })
  }

  function setHeader(col: number, val: string) {
    setHeaders(prev => { const n = [...prev]; n[col] = val; return n })
  }

  function setCell(row: number, col: number, val: string) {
    setCells(prev => {
      const n = prev.map(r => [...r])
      n[row][col] = val
      return n
    })
  }

  function buildRows() {
    const mappedCols = headers
      .map((h, i) => ({ field: h, colIdx: i }))
      .filter(c => c.field !== '')

    if (!mappedCols.find(c => c.field === 'name')) {
      alert('Please assign at least the "Org Name" column header.')
      return
    }

    const rows: Record<string, string>[] = []
    for (const row of cells) {
      const hasData = row.some(c => c.trim() !== '')
      if (!hasData) continue
      const obj: Record<string, string> = {}
      mappedCols.forEach(({ field, colIdx }) => {
        if (row[colIdx]?.trim()) obj[field] = row[colIdx].trim()
      })
      if (obj.name) rows.push(obj)
    }
    if (rows.length === 0) { alert('No data rows found. Make sure you paste data and assign the Org Name column.'); return }
    onRowsReady(rows)
  }

  const selCount = selectedRows.size

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#64748B]">
          Assign column headers, then paste data from Excel/Sheets into any cell.
          Click row numbers to select · Shift+click for range · Del to clear · ⌘C/X/V for clipboard ops.
        </p>
        {selCount > 0 && (
          <span className="shrink-0 ml-3 text-[11px] font-medium text-[#1A56DB] bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">
            {selCount} row{selCount > 1 ? 's' : ''} selected
          </span>
        )}
      </div>
      <div
        ref={gridRef}
        className="overflow-x-auto border border-[#E2E8F0] rounded-xl outline-none"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
      >
        <table className="text-xs border-collapse w-full min-w-max">
          <thead>
            <tr className="bg-[#F1F5F9]">
              <td className="w-8 px-2 py-1.5 text-[#94A3B8] text-center border-r border-b border-[#E2E8F0] select-none">#</td>
              {Array(colCount).fill(null).map((_, ci) => (
                <td key={ci} className="min-w-[140px] border-r border-b border-[#E2E8F0] p-0">
                  <select
                    value={headers[ci] ?? ''}
                    onChange={e => setHeader(ci, e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-[#F1F5F9] border-0 focus:outline-none focus:bg-blue-50"
                  >
                    <option value="">— Select column —</option>
                    {DB_FIELDS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}{f.required ? ' *' : ''}</option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, ri) => {
              const isSelected = selectedRows.has(ri)
              return (
                <tr
                  key={ri}
                  className={isSelected ? 'bg-blue-50' : 'hover:bg-[#F8FAFC]'}
                >
                  <td
                    onClick={e => handleRowNumberClick(ri, e)}
                    className={`px-2 py-1 text-center border-r border-b border-[#F1F5F9] select-none cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1A56DB] text-white font-semibold'
                        : 'text-[#CBD5E1] hover:bg-[#E2E8F0] hover:text-[#64748B]'
                    }`}
                  >
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`border-r border-b border-[#F1F5F9] p-0 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <input
                        value={cell}
                        onChange={e => setCell(ri, ci, e.target.value)}
                        onPaste={e => handleCellPaste(e, ri, ci)}
                        className="w-full px-2 py-1 text-xs bg-transparent focus:outline-none focus:bg-blue-100 min-w-[140px]"
                        placeholder={ri === 0 ? (DB_FIELDS.find(f => f.value === headers[ci])?.label ?? '') : ''}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        {selCount > 0 ? (
          <button
            onClick={() => {
              setCells(prev => {
                const next = prev.map(r => [...r])
                selectedRows.forEach(ri => { next[ri] = Array(colCount).fill('') })
                return next
              })
              setSelectedRows(new Set())
            }}
            className="px-4 py-1.5 text-xs font-medium text-[#EF4444] border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear {selCount} selected row{selCount > 1 ? 's' : ''}
          </button>
        ) : <div />}
        <button
          onClick={buildRows}
          className="px-5 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] transition-colors"
        >
          Use This Data
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadMode, setUploadMode] = useState<'csv' | 'grid'>('csv')
  const [datasetName, setDatasetName] = useState('')
  const [datasetSource, setDatasetSource] = useState('NGOverse')

  // Shared parsed rows state
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})

  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ created: number; skipped: number; duplicates?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchDatasets() }, [])

  async function fetchDatasets() {
    const res = await fetch('/api/datasets')
    const data = await res.json()
    setDatasets(data ?? [])
    setLoading(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      processCSVText(text)
    }
    reader.readAsText(file)
  }

  function processCSVText(text: string) {
    const { headers, rows } = parseCSVText(text)
    if (headers.length === 0) { alert('Could not parse CSV. Make sure it has a header row.'); return }
    setCsvHeaders(headers)
    setColumnMap(autoMapHeaders(headers))
    setParsedRows(rows)
  }

  function handleGridRows(rows: Record<string, string>[]) {
    setParsedRows(rows)
    setCsvHeaders([]) // no column mapper needed for grid
  }

  async function handleUpload() {
    if (!datasetName.trim()) return alert('Dataset name is required')
    if (parsedRows.length === 0) return alert('No rows to upload. Add data first.')
    setUploading(true)
    setUploadResult(null)

    // Create dataset record
    const dsRes = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: datasetName.trim(), source: datasetSource }),
    })
    const dataset = await dsRes.json()
    if (!dataset.id) { alert('Failed to create dataset.'); setUploading(false); return }

    // Map rows using column mapper (CSV mode) or use as-is (grid mode)
    const mappedRows = csvHeaders.length > 0
      ? parsedRows.map(row => {
          const mapped: Record<string, string> = {}
          Object.entries(columnMap).forEach(([csvCol, dbField]) => {
            if (dbField && row[csvCol] !== undefined && row[csvCol] !== '') {
              mapped[dbField] = row[csvCol]
            }
          })
          return mapped
        })
      : parsedRows // grid rows are already keyed by DB field name

    const res = await fetch('/api/datasets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: dataset.id, rows: mappedRows }),
    })
    const result = await res.json()
    setUploadResult(result)
    fetchDatasets()
    // Reset data
    setParsedRows([])
    setCsvHeaders([])
    setColumnMap({})
    setUploading(false)
  }

  function resetUpload() {
    setShowUpload(false)
    setDatasetName('')
    setParsedRows([])
    setCsvHeaders([])
    setColumnMap({})
    setUploadResult(null)
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Datasets" subtitle="Manage and upload lead datasets" />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        <div className="flex items-center justify-between">
          <div />
          <div className="flex gap-2">
            <a
              href="/api/admin/export"
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] text-[#64748B] text-sm font-medium rounded-lg hover:bg-[#F8FAFC] transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Full Log
            </a>
            <button
              onClick={() => { setShowUpload(!showUpload); setUploadResult(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Dataset
            </button>
          </div>
        </div>

        {/* ── Upload panel ── */}
        {showUpload && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0F172A]">Upload New Dataset</h3>
              <button onClick={resetUpload} className="text-[#94A3B8] hover:text-[#64748B]"><X className="w-4 h-4" /></button>
            </div>

            {/* Dataset metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Dataset Name <span className="text-red-500">*</span></label>
                <input
                  value={datasetName}
                  onChange={e => setDatasetName(e.target.value)}
                  placeholder="NGOverse April 2026"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Source</label>
                <select
                  value={datasetSource}
                  onChange={e => setDatasetSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                >
                  {['NGOverse', 'LinkedIn', 'Manual', 'Referral', 'Other'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex border-b border-[#E2E8F0]">
              <button
                onClick={() => { setUploadMode('csv'); setParsedRows([]); setCsvHeaders([]) }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${uploadMode === 'csv' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}
              >
                <FileText className="w-4 h-4" />
                Upload CSV File
              </button>
              <button
                onClick={() => { setUploadMode('grid'); setParsedRows([]); setCsvHeaders([]) }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${uploadMode === 'grid' ? 'border-[#1A56DB] text-[#1A56DB]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'}`}
              >
                <Table2 className="w-4 h-4" />
                Paste from Spreadsheet
              </button>
            </div>

            {/* ── CSV Upload mode ── */}
            {uploadMode === 'csv' && (
              <div className="space-y-4">
                {/* Template download */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div>
                    <p className="text-xs font-semibold text-[#1A56DB]">Expected CSV format</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">
                      Header row required · 24 columns: org fields (name, url, location, annual_revenue, team_size, age_years, thematic_areas, linkedin_url) + KDM1–3 (name, phone, email, designation, linkedin each)
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
                      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                      a.download = 'daanveda_upload_template.csv'; a.click()
                    }}
                    className="shrink-0 ml-3 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-[#1A56DB] text-xs font-medium rounded-lg hover:bg-blue-50"
                  >
                    <Download className="w-3 h-3" />
                    Template
                  </button>
                </div>

                {/* File input */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] rounded-xl p-8 cursor-pointer hover:border-[#1A56DB]/40 hover:bg-blue-50/30 transition-colors"
                >
                  <Upload className="w-8 h-8 text-[#94A3B8] mb-2" />
                  <p className="text-sm font-medium text-[#0F172A]">Click to select CSV file</p>
                  <p className="text-xs text-[#94A3B8] mt-1">or drag and drop</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                {parsedRows.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-xs text-green-700 font-medium">
                    ✅ {parsedRows.length} rows parsed · {csvHeaders.length} columns detected
                  </div>
                )}

                {/* Column mapper */}
                {csvHeaders.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-2">
                      Map CSV Columns → Database Fields
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {csvHeaders.map(h => (
                        <div key={h} className="flex items-center gap-2">
                          <span className="text-xs text-[#0F172A] truncate w-24 shrink-0 font-medium">{h}</span>
                          <span className="text-[#CBD5E1] text-xs">→</span>
                          <select
                            value={columnMap[h] ?? ''}
                            onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value }))}
                            className="flex-1 px-2 py-1 text-xs border border-[#E2E8F0] rounded focus:outline-none focus:ring-1 focus:ring-[#1A56DB]/30"
                          >
                            <option value="">Skip</option>
                            {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Paste grid mode ── */}
            {uploadMode === 'grid' && (
              <PasteGrid onRowsReady={handleGridRows} />
            )}

            {/* Parsed row count + upload button */}
            {parsedRows.length > 0 && (
              <>
                {uploadResult && (
                  <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                    ✅ {uploadResult.created} records created · {uploadResult.skipped} skipped
                    {(uploadResult.duplicates ?? []).length > 0 && (
                      <span className="text-[11px] text-green-600 block mt-0.5">
                        Duplicates: {uploadResult.duplicates?.slice(0, 5).join(', ')}{(uploadResult.duplicates?.length ?? 0) > 5 ? '...' : ''}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !datasetName.trim()}
                    className="px-5 py-2 bg-[#059669] text-white text-sm font-medium rounded-lg hover:bg-[#047857] disabled:opacity-60 transition-colors"
                  >
                    {uploading ? 'Uploading...' : `Upload ${parsedRows.length} Records`}
                  </button>
                  <button
                    onClick={() => { setParsedRows([]); setCsvHeaders([]) }}
                    className="px-4 py-2 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC]"
                  >
                    Clear Data
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Datasets list ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Dataset</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Source</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Records</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {datasets.map(d => (
                <tr key={d.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 font-medium text-[#0F172A]">{d.name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{d.source}</span>
                  </td>
                  <td className="px-5 py-3 text-[#64748B]">{d.total_records ?? 0} records</td>
                  <td className="px-5 py-3 text-xs text-[#94A3B8]">{formatDate(d.created_at)}</td>
                </tr>
              ))}
              {datasets.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No datasets uploaded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
