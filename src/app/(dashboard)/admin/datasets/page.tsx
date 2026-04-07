'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import { formatDate } from '@/lib/utils'
import { Upload, Plus, X, Check } from 'lucide-react'
import type { Dataset } from '@/types/database'

// CSV column mapping
const DB_FIELDS = [
  { value: 'name', label: 'Org Name *' },
  { value: 'url', label: 'Website' },
  { value: 'location', label: 'Location' },
  { value: 'annual_revenue', label: 'Annual Revenue' },
  { value: 'team_size', label: 'Team Size' },
  { value: 'age_years', label: 'Age (years)' },
  { value: 'thematic_areas', label: 'Thematic Areas' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'kdm_name', label: 'KDM Name' },
  { value: 'kdm_phone', label: 'KDM Phone' },
  { value: 'kdm_email', label: 'KDM Email' },
  { value: 'kdm_designation', label: 'KDM Designation' },
]

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [datasetName, setDatasetName] = useState('')
  const [datasetSource, setDatasetSource] = useState('NGOverse')
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ created: number; skipped: number } | null>(null)

  useEffect(() => { fetchDatasets() }, [])

  async function fetchDatasets() {
    const res = await fetch('/api/datasets')
    const data = await res.json()
    setDatasets(data ?? [])
    setLoading(false)
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    setCsvHeaders(headers)
    // Auto-map headers to DB fields
    const autoMap: Record<string, string> = {}
    headers.forEach(h => {
      const normalized = h.toLowerCase().replace(/\s+/g, '_')
      const match = DB_FIELDS.find(f =>
        f.value === normalized ||
        f.label.toLowerCase().includes(h.toLowerCase()) ||
        h.toLowerCase().includes(f.value.replace('_', ' '))
      )
      if (match) autoMap[h] = match.value
    })
    setColumnMap(autoMap)
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
    })
    setParsedRows(rows)
  }

  async function handleUpload() {
    if (!datasetName) return alert('Dataset name is required')
    if (parsedRows.length === 0) return alert('No rows to upload')
    setUploading(true)

    // Create dataset
    const dsRes = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: datasetName, source: datasetSource }),
    })
    const dataset = await dsRes.json()

    // Map rows to DB fields
    const mappedRows = parsedRows.map(row => {
      const mapped: Record<string, string> = {}
      Object.entries(columnMap).forEach(([csvCol, dbField]) => {
        if (row[csvCol]) mapped[dbField] = row[csvCol]
      })
      return mapped
    })

    const res = await fetch('/api/datasets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: dataset.id, rows: mappedRows }),
    })
    const result = await res.json()
    setUploadResult(result)
    fetchDatasets()
    setUploading(false)
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Datasets" subtitle="Manage and upload lead datasets" />
      <div className="flex-1 p-6 space-y-5">

        <div className="flex justify-end">
          <button onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] transition-colors">
            <Upload className="w-4 h-4" />
            Upload Dataset
          </button>
        </div>

        {/* Upload section */}
        {showUpload && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-[#0F172A]">Upload New Dataset</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Dataset Name</label>
                <input value={datasetName} onChange={e => setDatasetName(e.target.value)} placeholder="NGOverse April 2026" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Source</label>
                <select value={datasetSource} onChange={e => setDatasetSource(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
                  {['NGOverse','LinkedIn','Manual','Referral','Other'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Paste CSV data below</label>
              <textarea
                value={csvText}
                onChange={e => { setCsvText(e.target.value); parseCSV(e.target.value) }}
                rows={6}
                placeholder="Paste CSV here (with header row)&#10;Name,Website,Location,Team Size,KDM Name,KDM Phone&#10;Greenpeace India,greenpeace.in,Mumbai,25,Ravi Kumar,9876543210"
                className="w-full px-3 py-2 text-sm font-mono border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-y"
              />
              {csvHeaders.length > 0 && <p className="text-xs text-[#94A3B8] mt-1">{parsedRows.length} rows parsed · {csvHeaders.length} columns detected</p>}
            </div>

            {/* Column mapper */}
            {csvHeaders.length > 0 && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-2">Map CSV columns to database fields</label>
                <div className="grid grid-cols-3 gap-2">
                  {csvHeaders.map(h => (
                    <div key={h} className="flex items-center gap-2">
                      <span className="text-xs text-[#0F172A] truncate w-24 shrink-0">{h}</span>
                      <span className="text-[#94A3B8]">→</span>
                      <select
                        value={columnMap[h] ?? ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value }))}
                        className="flex-1 px-2 py-1 text-xs border border-[#E2E8F0] rounded focus:outline-none"
                      >
                        <option value="">Skip</option>
                        {DB_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                ✅ {uploadResult.created} records created · {uploadResult.skipped} skipped (duplicates)
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleUpload} disabled={uploading || parsedRows.length === 0}
                className="px-5 py-2 bg-[#059669] text-white text-sm font-medium rounded-lg hover:bg-[#047857] disabled:opacity-60 transition-colors">
                {uploading ? 'Uploading...' : `Upload ${parsedRows.length} Records`}
              </button>
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC]">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Datasets list */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F1F5F9]">
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Dataset</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Source</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Records</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Uploaded</th>
            </tr></thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {datasets.map(d => (
                <tr key={d.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 font-medium text-[#0F172A]">{d.name}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{d.source}</span></td>
                  <td className="px-5 py-3 text-[#64748B]">{d.total_records} records</td>
                  <td className="px-5 py-3 text-xs text-[#94A3B8]">{formatDate(d.created_at)}</td>
                </tr>
              ))}
              {datasets.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No datasets uploaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
