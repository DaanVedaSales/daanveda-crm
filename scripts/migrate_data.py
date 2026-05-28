#!/usr/bin/env python3
"""
DaanVeda CRM — Historical Data Migration Script
================================================
Migrates 3 Excel files into the live Supabase database.

Files:
  ~/Downloads/Converted_Clients_May_2026.xlsx  →  won/converted deals
  ~/Downloads/Closer_Pipeline_Template.xlsx    →  closer Kanban pipeline
  ~/Downloads/SDR_Leads_Final.xlsx             →  SDR My Leads / Follow-up Queue

Usage:
  python scripts/migrate_data.py --dry-run    # Preview counts, no DB writes
  python scripts/migrate_data.py              # Execute full migration
"""

import sys
import re
import argparse
import warnings
from pathlib import Path
from datetime import datetime

warnings.filterwarnings('ignore')

try:
    import pandas as pd
    import requests
    from dateutil import parser as dateutil_parser
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip3 install requests python-dateutil pandas openpyxl")
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / '.env.local'
CONVERTED_FILE = Path.home() / 'Downloads/Converted_Clients_May_2026.xlsx'
CLOSER_FILE    = Path.home() / 'Downloads/Closer_Pipeline_Template.xlsx'
SDR_FILE       = Path.home() / 'Downloads/SDR_Leads_Final.xlsx'

# ── Load .env.local ───────────────────────────────────────────────────────────
env_vars = {}
try:
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")
except FileNotFoundError:
    print(f"ERROR: {ENV_FILE} not found"); sys.exit(1)

SUPABASE_URL     = env_vars.get('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SERVICE_ROLE_KEY = env_vars.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

HEADERS = {
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
}

# ── User ID Maps (confirmed from live DB) ────────────────────────────────────
ADMIN_ID = 'e34100a2-8ba7-402e-b3de-20605fb4e7b3'

SDR_MAP = {
    'anshika':       '67d623fb-0f88-4cbc-b95a-03622b725290',
    'harshit':       'aa1cb6ab-9a35-4293-9463-af5b596a1ccd',
    'laxmi':         'b5f939d3-dbf9-4296-9696-8bfa4c873551',
    'pratibha':      'f08ae5e0-08c0-4d38-839e-1af8e24e9002',
    'pratibha priya':'f08ae5e0-08c0-4d38-839e-1af8e24e9002',
    # Closers who also appear as SDR in pipeline data
    'irfan':         'a5852c5c-a540-4b29-966e-34d676f806ad',
    'anurag':        '8442d563-3df3-4954-b6c4-67bd611ad4fa',
    'himanshu':      'ddc7f2da-2dd9-4b00-8553-88997562a96b',
    'kaif':          '31075adf-da69-41b0-8bc1-b28cf1547d73',
    'megha':         '9acc6922-902a-427a-a6cc-354a25bbea89',
    'muskan':        'ddc3402e-f672-42f9-b4a7-a7adcf39362f',
    # Himani, Keerthana → NOT in DB → None (unassigned)
}

CLOSER_MAP = {
    'anurag':   '8442d563-3df3-4954-b6c4-67bd611ad4fa',
    'himanshu': 'ddc7f2da-2dd9-4b00-8553-88997562a96b',
    'irfan':    'a5852c5c-a540-4b29-966e-34d676f806ad',
    'kaif':     '31075adf-da69-41b0-8bc1-b28cf1547d73',
    'megha':    '9acc6922-902a-427a-a6cc-354a25bbea89',
    'muskan':   'ddc3402e-f672-42f9-b4a7-a7adcf39362f',
}

# SDR names that should go unassigned (not real DB users or role-changed)
UNASSIGNED_SDR_NAMES = {'himani', 'keerthana', 'sdr', 'not in sdr file'}

# ── Migration Stats ───────────────────────────────────────────────────────────
stats = {
    'converted': {'created': 0, 'skipped': 0, 'errors': 0},
    'closer':    {'created': 0, 'skipped': 0, 'errors': 0},
    'sdr':       {'created': 0, 'skipped': 0, 'errors': 0},
    'sdr_skipped_in_db': [],
}

# ── DB Helpers ────────────────────────────────────────────────────────────────
def db_insert(table, data, dry_run=False):
    """Insert a row; returns {'id': ...}. On dry_run returns a fake UUID."""
    if dry_run:
        import uuid
        return {'id': str(uuid.uuid4())}
    url = f'{SUPABASE_URL}/rest/v1/{table}'
    resp = requests.post(url, headers=HEADERS, json=data, timeout=15)
    if resp.status_code in (200, 201):
        r = resp.json()
        return r[0] if isinstance(r, list) else r
    raise Exception(f"INSERT {table} [{resp.status_code}]: {resp.text[:400]}")

def db_patch(table, row_id, data, dry_run=False):
    """Update a row by id."""
    if dry_run:
        return
    patch_headers = {**HEADERS, 'Prefer': 'return=minimal'}
    url = f'{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}'
    resp = requests.patch(url, headers=patch_headers, json=data, timeout=15)
    if resp.status_code not in (200, 204):
        raise Exception(f"PATCH {table}/{row_id} [{resp.status_code}]: {resp.text[:400]}")

def db_get(path):
    """Raw GET against the REST API. Returns list of dicts."""
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code == 200:
        return resp.json()
    raise Exception(f"GET {path} [{resp.status_code}]: {resp.text[:400]}")

# ── Value Coercion Helpers ────────────────────────────────────────────────────
def sv(val):
    """Return stripped string or None for blank/NaN."""
    if val is None:
        return None
    if isinstance(val, float) and val != val:   # NaN
        return None
    v = str(val).strip()
    return v if v and v.lower() not in ('nan', 'none', 'n/a', '-', '') else None

def numeric(val):
    """Parse to float or None."""
    raw = sv(val)
    if not raw:
        return None
    try:
        return float(raw.replace(',', '').replace('₹', '').replace(' ', ''))
    except Exception:
        return None

def safe_int(val):
    v = numeric(val)
    return int(v) if v is not None else None

def deal_val(val):
    """Return deal value if >= 30000 (DB constraint), else None.
    Also rejects obvious corruption (> 10 million)."""
    v = numeric(val)
    if v is None:
        return None
    if v > 10_000_000 or v < 30_000:
        return None
    return v

def parse_iso(val, fallback=None):
    """Parse date/datetime to ISO string, or return fallback."""
    raw = sv(val)
    if not raw:
        return fallback
    try:
        if isinstance(val, datetime):
            return val.isoformat()
        return dateutil_parser.parse(raw).isoformat()
    except Exception:
        return fallback

def parse_date_only(val):
    """Parse to YYYY-MM-DD string or None."""
    raw = sv(val)
    if not raw:
        return None
    try:
        if isinstance(val, datetime):
            return val.strftime('%Y-%m-%d')
        return dateutil_parser.parse(raw).strftime('%Y-%m-%d')
    except Exception:
        return None

def thematic_list(val):
    """Parse comma/semicolon-separated thematic areas into a list."""
    raw = sv(val)
    if not raw:
        return []
    parts = re.split(r'[,;|/]+', raw)
    return [p.strip() for p in parts if p.strip()]

def map_sdr_id(name_val):
    """Map SDR name → user ID. Returns None for unrecognised / Himani / Keerthana."""
    raw = sv(name_val)
    if not raw:
        return None
    key = raw.lower().strip()
    if key in UNASSIGNED_SDR_NAMES:
        return None
    return SDR_MAP.get(key, None)

def map_closer_id(name_val):
    raw = sv(name_val)
    if not raw:
        return None
    return CLOSER_MAP.get(raw.lower().strip(), None)

def map_deal_stage(val):
    raw = sv(val)
    if not raw:
        return 'demo_done'
    mapping = {
        'demo_done':     'demo_done',
        'follow_up':     'follow_up',
        'negotiation':   'negotiation',
        'proposal_sent': 'proposal_sent',
        'won':           'won',
        'lost':          'lost',
        'ghosted':       'ghosted',
        'converted':     'converted',
        'unqualified':   'unqualified',
    }
    return mapping.get(raw.lower(), 'demo_done')

def map_demo_status(val):
    raw = sv(val)
    if not raw:
        return 'attended'
    r = raw.lower()
    if 'not shown' in r or 'no show' in r or 'no_show' in r:
        return 'no_show'
    # Everything else (done, attended, scheduled, not qualified) → attended
    # (historical: if it's in the pipeline, the demo happened)
    return 'attended'

def map_sdr_status(val):
    """Map Excel lead_status → DB lead_status enum."""
    raw = sv(val)
    if not raw:
        return 'new'
    r = raw.lower().strip()
    return {
        'new':             'new',
        'contacted':       'call_again',   # contacted → follow-up queue
        'call_again':      'call_again',
        'follow_up':       'call_again',
        'interested':      'hot',
        'invalid_contact': 'not_reachable',
        'not_reachable':   'not_reachable',
        'hot':             'hot',
        'warm':            'contacted',
    }.get(r, 'new')

def map_interest_signal(val):
    raw = sv(val)
    if not raw:
        return None
    r = raw.lower()
    return r if r in ('hot', 'warm', 'cold', 'dead') else None

def map_activity_type(val):
    raw = sv(val)
    if not raw:
        return 'note'
    return {'call': 'call', 'email': 'email', 'linkedin': 'linkedin',
            'whatsapp': 'whatsapp', 'note': 'note'}.get(raw.lower(), 'note')

def map_lead_type(val):
    raw = sv(val)
    if raw in ('Inbound', 'Outbound', 'Referral'):
        return raw
    return 'Outbound'

# ── Closer Notes Parser ───────────────────────────────────────────────────────
MONTH_NUM = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}

def _infer_year(month_num):
    # Today: May 2026. Months Jan–May → 2026; Jun–Dec → 2025.
    return 2026 if month_num <= 5 else 2025

def _parse_note_date(token):
    """Parse a loose date token like '21st may', 'Jan 5', 'oct 17'."""
    token = token.strip()

    # "21st may" / "6th march" / "25th May"
    m = re.match(r'^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)', token, re.IGNORECASE)
    if m:
        day, mon = int(m.group(1)), m.group(2).lower()[:3]
        if mon in MONTH_NUM:
            mo = MONTH_NUM[mon]
            try:
                return datetime(_infer_year(mo), mo, min(day, 28))
            except Exception:
                pass

    # "Jan 5" / "Oct 17"
    m = re.match(r'^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?', token, re.IGNORECASE)
    if m:
        mon, day = m.group(1).lower()[:3], int(m.group(2))
        if mon in MONTH_NUM:
            mo = MONTH_NUM[mon]
            try:
                return datetime(_infer_year(mo), mo, min(day, 28))
            except Exception:
                pass

    return datetime.now()

def parse_closer_notes(text, deal_id, closer_id, deal_stage_str):
    """Split closer_notes into individual deal_comment records."""
    raw = sv(text)
    if not raw:
        return []

    comments = []
    # Primary separator: " / " (with spaces). Fallback: newline.
    parts = re.split(r'\s+/\s+|\n', raw)

    for part in parts:
        part = part.strip()
        if not part:
            continue

        # Try to find a date prefix at the start of the chunk
        # Patterns: "21st may:", "Jan 5:", "oct 17:", "6th march:"
        dm = re.match(
            r'^((?:\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+|[a-zA-Z]+\s+\d{1,2}(?:st|nd|rd|th)?))\s*:?\s+',
            part, re.IGNORECASE
        )
        if dm:
            parsed_dt = _parse_note_date(dm.group(1))
            comment_text = part[dm.end():].strip()
        else:
            # Day-only prefix like "24:" → no meaningful date, use today
            dm2 = re.match(r'^\d{1,2}(?:st|nd|rd|th)?\s*:\s*', part, re.IGNORECASE)
            comment_text = part[dm2.end():].strip() if dm2 else part
            parsed_dt = datetime.now()

        if comment_text:
            comments.append({
                'deal_id':    deal_id,
                'user_id':    closer_id,
                'comment':    comment_text,
                'deal_stage': deal_stage_str,
                'created_at': parsed_dt.strftime('%Y-%m-%dT10:00:00+00:00'),
            })

    return comments

# ── Pre-process Closer Pipeline: Deduplicate ─────────────────────────────────
def preprocess_closer(df):
    """
    Handle duplicate org names in the Closer Pipeline:
      - TFIx:             one deal, deal_value=None, notes from BOTH rows combined
      - Sambhav Foundation: keep the ₹46,900 row only
      - All other dups:   keep first occurrence, drop rest
    Returns (cleaned_df, notes_override_dict)
    """
    df = df.copy()
    df['_key'] = df['org_name'].apply(
        lambda x: str(x).strip().lower() if pd.notna(x) else ''
    )

    notes_override = {}   # _key → combined notes string
    drop_indices   = []

    grouped = df.groupby('_key', sort=False)
    for key, grp in grouped:
        if len(grp) <= 1 or not key:
            continue

        if 'tfix' in key:
            # Combine notes from all TFIx rows; null out deal_value on kept row
            all_notes = [
                sv(r['closer_notes'])
                for _, r in grp.iterrows()
                if sv(r.get('closer_notes'))
            ]
            notes_override[key] = ' / '.join(filter(None, all_notes))
            drop_indices.extend(grp.index[1:].tolist())

        elif 'sambhav foundation' in key:
            # Keep the row closest to ₹46,900
            def _dv(r):
                v = numeric(r.get('deal_value'))
                return v if v else 0

            sorted_rows = sorted(
                [(idx, _dv(row)) for idx, row in grp.iterrows()],
                key=lambda x: abs(x[1] - 46900)
            )
            keep_idx = sorted_rows[0][0]
            drop_indices.extend([idx for idx, _ in sorted_rows[1:]])

        else:
            # Generic: keep first, drop rest
            drop_indices.extend(grp.index[1:].tolist())

    df = df.drop(index=drop_indices).reset_index(drop=True)
    df = df.drop(columns=['_key'])
    return df, notes_override

# ── Pre-flight: Load Existing DB State ───────────────────────────────────────
def load_db_state():
    print("\nLoading existing database state...")

    # All orgs → {lower_name: org_id}
    orgs_raw = db_get('organizations?select=id,name,is_client&limit=2000')
    org_by_name  = {r['name'].strip().lower(): r['id'] for r in orgs_raw}
    client_orgs  = {r['name'].strip().lower() for r in orgs_raw if r.get('is_client')}

    # Orgs that already have active deals → set of lower names
    deals_raw = db_get('deals?select=org_id&is_deleted=eq.false&limit=500')
    org_ids_with_deals = {r['org_id'] for r in deals_raw}
    org_id_to_lower = {r['id']: r['name'].strip().lower() for r in orgs_raw}
    orgs_with_deal_names = {
        org_id_to_lower[oid]
        for oid in org_ids_with_deals
        if oid in org_id_to_lower
    }

    # Existing leads → {org_id: lead record}
    leads_raw = db_get('leads?select=id,org_id,phase,status&is_deleted=eq.false&limit=2000')
    lead_by_org = {r['org_id']: r for r in leads_raw}

    print(f"  {len(org_by_name):4d} orgs in DB")
    print(f"  {len(orgs_with_deal_names):4d} orgs with active deals")
    print(f"  {len(lead_by_org):4d} active leads in DB")

    return org_by_name, client_orgs, orgs_with_deal_names, lead_by_org

# ── FILE 1: Converted Clients ─────────────────────────────────────────────────
def process_converted(df, org_by_name, client_orgs, dry_run):
    print("\n─── CONVERTED CLIENTS ──────────────────────────────────────────────")
    now = datetime.now().isoformat()
    converted_org_names = set()

    for _, row in df.iterrows():
        org_name = sv(row.iloc[0])
        if not org_name:
            continue
        org_key = org_name.strip().lower()
        converted_org_names.add(org_key)

        if org_key in client_orgs:
            print(f"  SKIP (already client in DB): {org_name}")
            stats['converted']['skipped'] += 1
            continue

        try:
            # 1. Organization
            if org_key in org_by_name:
                org_id = org_by_name[org_key]
                db_patch('organizations', org_id, {'is_client': True, 'icp_verified': True}, dry_run)
            else:
                org_result = db_insert('organizations', {
                    'name':           org_name,
                    'location':       sv(row.iloc[1]),
                    'url':            sv(row.iloc[2]),
                    'linkedin_url':   sv(row.iloc[3]),
                    'thematic_areas': thematic_list(row.iloc[4]),
                    'is_client':      True,
                    'icp_verified':   True,
                }, dry_run)
                org_id = org_result['id']
                org_by_name[org_key] = org_id

            # 2. Contact (primary KDM)
            contact_name = sv(row.iloc[5])
            if contact_name:
                db_insert('contacts', {
                    'org_id':      org_id,
                    'name':        contact_name,
                    'designation': sv(row.iloc[6]),
                    'phone':       sv(row.iloc[7]),
                    'email':       sv(row.iloc[8]),
                    'linkedin_url':sv(row.iloc[9]),
                    'is_primary':  True,
                }, dry_run)

            # 3. User IDs
            sdr_name_raw = sv(row.iloc[10])
            closer_name_raw = sv(row.iloc[11])
            sdr_id    = map_sdr_id(sdr_name_raw) or ADMIN_ID  # NOT NULL → fallback admin
            closer_id = map_closer_id(closer_name_raw) or ADMIN_ID

            conv_date = parse_iso(row.iloc[12], fallback=now)

            # 4. Lead
            lead = db_insert('leads', {
                'org_id':      org_id,
                'assigned_to': closer_id,
                'assigned_by': ADMIN_ID,
                'status':      'converted',
                'phase':       'converted',
            }, dry_run)
            lead_id = lead['id']

            # 5. Demo (synthetic — historical record)
            demo = db_insert('demos', {
                'lead_id':     lead_id,
                'org_id':      org_id,
                'sdr_id':      sdr_id,
                'closer_id':   closer_id,
                'demo_date':   conv_date,
                'sdr_summary': 'Historical converted client — demo pre-dated the CRM system.',
                'status':      'attended',
            }, dry_run)
            demo_id = demo['id']

            # 6. Deal
            dv = deal_val(row.iloc[13])
            db_insert('deals', {
                'demo_id':      demo_id,
                'lead_id':      lead_id,
                'org_id':       org_id,
                'closer_id':    closer_id,
                'stage':        'converted',
                'deal_value':   dv,
                'plan_type':    sv(row.iloc[14]),
                'billing_name': sv(row.iloc[15]),
            }, dry_run)

            stats['converted']['created'] += 1
            print(f"  OK  {org_name}  (SDR: {sdr_name_raw or 'N/A'} | Closer: {closer_name_raw} | ₹{dv or '—'})")

        except Exception as exc:
            stats['converted']['errors'] += 1
            print(f"  ERR {org_name}  →  {exc}")

    return converted_org_names

# ── FILE 2: Closer Pipeline ───────────────────────────────────────────────────
def process_closer(df_raw, org_by_name, orgs_with_deal_names, lead_by_org,
                   converted_org_names, dry_run):
    print("\n─── CLOSER PIPELINE ────────────────────────────────────────────────")
    now = datetime.now().isoformat()

    df, notes_override = preprocess_closer(df_raw)
    closer_org_names = set()

    for _, row in df.iterrows():
        org_name = sv(row.get('org_name'))
        if not org_name:
            continue
        org_key = org_name.strip().lower()

        # Priority skip checks
        if org_key in converted_org_names:
            print(f"  SKIP (converted client): {org_name}")
            stats['closer']['skipped'] += 1
            continue
        if org_key in orgs_with_deal_names:
            print(f"  SKIP (deal exists in DB): {org_name}")
            stats['closer']['skipped'] += 1
            continue

        try:
            sdr_id    = map_sdr_id(row.get('sdr_name')) or ADMIN_ID
            closer_id = map_closer_id(row.get('closer_name')) or ADMIN_ID

            # 1. Organization
            if org_key in org_by_name:
                org_id = org_by_name[org_key]
            else:
                org_result = db_insert('organizations', {
                    'name':           org_name,
                    'location':       sv(row.get('org_location')),
                    'url':            sv(row.get('org_website')),
                    'linkedin_url':   sv(row.get('org_linkedin')),
                    'thematic_areas': thematic_list(row.get('org_thematic_areas')),
                    'sql_score':      safe_int(row.get('org_sql_score')) or 0,
                    'annual_revenue': numeric(row.get('org_annual_revenue')),
                    'team_size':      safe_int(row.get('org_team_size')),
                    'age_years':      safe_int(row.get('org_age_years')),
                }, dry_run)
                org_id = org_result['id']
                org_by_name[org_key] = org_id

            # 2. Contact (primary KDM)
            contact_name = sv(row.get('contact_name'))
            if contact_name:
                db_insert('contacts', {
                    'org_id':      org_id,
                    'name':        contact_name,
                    'designation': sv(row.get('contact_designation')),
                    'phone':       sv(row.get('contact_phone')),
                    'email':       sv(row.get('contact_email')),
                    'linkedin_url':sv(row.get('contact_linkedin')),
                    'is_primary':  True,
                }, dry_run)

            # 3. Lead — reuse existing or create new
            deal_stage_raw = sv(row.get('deal_stage')) or 'Follow_Up'
            db_deal_stage  = map_deal_stage(deal_stage_raw)
            lead_status    = {
                'demo_done':     'demo_done',
                'follow_up':     'follow_up',
                'negotiation':   'negotiation',
                'proposal_sent': 'proposal_sent',
                'won': 'won', 'lost': 'lost', 'ghosted': 'ghosted',
            }.get(db_deal_stage, 'demo_done')

            existing_lead = lead_by_org.get(org_id)
            if existing_lead:
                lead_id = existing_lead['id']
                db_patch('leads', lead_id, {
                    'phase':       'closer',
                    'status':      lead_status,
                    'assigned_to': closer_id,
                }, dry_run)
            else:
                lead = db_insert('leads', {
                    'org_id':      org_id,
                    'assigned_to': closer_id,
                    'assigned_by': ADMIN_ID,
                    'status':      lead_status,
                    'phase':       'closer',
                }, dry_run)
                lead_id = lead['id']
                lead_by_org[org_id] = {'id': lead_id}

            # 4. Demo
            demo_date = parse_iso(row.get('demo_date'), fallback=now)

            sdr_summary_parts = []
            for field_val in [sv(row.get('sdr_summary')), sv(row.get('pain_point')), sv(row.get('demo_expectation'))]:
                if field_val:
                    sdr_summary_parts.append(field_val)
            sdr_summary = ' | '.join(sdr_summary_parts) or 'Historical demo — context migrated from pre-CRM records.'

            demo = db_insert('demos', {
                'lead_id':              lead_id,
                'org_id':               org_id,
                'sdr_id':               sdr_id,
                'closer_id':            closer_id,
                'demo_date':            demo_date,
                'sdr_summary':          sdr_summary,
                'pain_point':           sv(row.get('pain_point')),
                'demo_expectation':     sv(row.get('demo_expectation')),
                'sdr_interest_signal':  map_interest_signal(row.get('sdr_interest_signal')),
                'status':               map_demo_status(row.get('demo_status')),
            }, dry_run)
            demo_id = demo['id']

            # 5. Deal
            # TFIx: deal_value = None per user instruction (leave blank)
            dv = None if 'tfix' in org_key else deal_val(row.get('deal_value'))

            deal = db_insert('deals', {
                'demo_id':        demo_id,
                'lead_id':        lead_id,
                'org_id':         org_id,
                'closer_id':      closer_id,
                'stage':          db_deal_stage,
                'deal_value':     dv,
                'plan_type':      sv(row.get('plan_type')),
                'next_follow_up': parse_date_only(row.get('next_follow_up')),
                'loss_reason':    sv(row.get('loss_reason')),
                'billing_name':   sv(row.get('billing_name')),
                'billing_address':sv(row.get('billing_address')),
                'gst_number':     sv(row.get('gst_number')),
                'poc_name':       sv(row.get('poc_name')),
                'poc_designation':sv(row.get('poc_designation')),
                'poc_phone':      sv(row.get('poc_phone')),
                'poc_email':      sv(row.get('poc_email')),
            }, dry_run)
            deal_id = deal['id']

            # 6. Closer Notes → deal_comments
            notes_text = notes_override.get(org_key) or sv(row.get('closer_notes'))
            comments   = parse_closer_notes(notes_text, deal_id, closer_id, db_deal_stage)
            for c in comments:
                db_insert('deal_comments', c, dry_run)

            closer_org_names.add(org_key)
            stats['closer']['created'] += 1
            sdr_label = sv(row.get('sdr_name')) or 'unassigned'
            print(f"  OK  {org_name}  [{db_deal_stage}]  SDR:{sdr_label} | Closer:{sv(row.get('closer_name'))} | ₹{dv or '—'} | {len(comments)} notes")

        except Exception as exc:
            stats['closer']['errors'] += 1
            print(f"  ERR {org_name}  →  {exc}")

    return closer_org_names

# ── FILE 3: SDR Leads ─────────────────────────────────────────────────────────
def process_sdr(df, org_by_name, converted_org_names, closer_org_names, dry_run):
    print("\n─── SDR LEADS ───────────────────────────────────────────────────────")
    now = datetime.now().isoformat()

    for _, row in df.iterrows():
        org_name = sv(row.get('org_name'))
        if not org_name:
            continue
        org_key = org_name.strip().lower()

        # Dedup checks (in priority order)
        if org_key in converted_org_names:
            stats['sdr']['skipped'] += 1
            continue
        if org_key in closer_org_names:
            stats['sdr']['skipped'] += 1
            continue
        if org_key in org_by_name:
            # Option B: skip entirely, log for user review
            stats['sdr']['skipped'] += 1
            stats['sdr_skipped_in_db'].append(org_name)
            continue

        try:
            # SDR assignment
            assigned_to_raw = sv(row.get('assigned_to'))
            # Kaif is now a Closer; Himani/Keerthana not in DB → all unassigned
            if assigned_to_raw and assigned_to_raw.lower() in UNASSIGNED_SDR_NAMES | {'kaif'}:
                sdr_id = None
            else:
                sdr_id = map_sdr_id(assigned_to_raw)

            # 1. Organization
            org_result = db_insert('organizations', {
                'name':           org_name,
                'location':       sv(row.get('org_location')),
                'url':            sv(row.get('org_website')),
                'linkedin_url':   sv(row.get('org_linkedin')),
                'thematic_areas': thematic_list(row.get('org_thematic_areas')),
                'sql_score':      safe_int(row.get('org_sql_score')) or 0,
                'annual_revenue': numeric(row.get('org_annual_revenue')),
                'team_size':      safe_int(row.get('org_team_size')),
                'age_years':      safe_int(row.get('org_age_years')),
            }, dry_run)
            org_id = org_result['id']
            org_by_name[org_key] = org_id

            # 2. Contact (primary KDM)
            contact_name = sv(row.get('contact_name'))
            if contact_name:
                db_insert('contacts', {
                    'org_id':      org_id,
                    'name':        contact_name,
                    'designation': sv(row.get('contact_designation')),
                    'phone':       sv(row.get('contact_phone')),
                    'email':       sv(row.get('contact_email')),
                    'linkedin_url':sv(row.get('contact_linkedin')),
                    'is_primary':  True,
                }, dry_run)

            # 3. Lead
            lead_status   = map_sdr_status(row.get('lead_status'))
            follow_up_date = parse_date_only(row.get('follow_up_date'))
            # call_again / follow_up → set callback_date so it appears in Follow-up Queue
            callback_date = follow_up_date if lead_status == 'call_again' else None

            lead = db_insert('leads', {
                'org_id':        org_id,
                'assigned_to':   sdr_id,
                'assigned_by':   ADMIN_ID if sdr_id else None,
                'status':        lead_status,
                'phase':         'sdr',
                'interest_signal': map_interest_signal(row.get('interest_signal')),
                'callback_date': callback_date,
                'follow_up_date':follow_up_date,
                'lead_type':     map_lead_type(row.get('lead_type')),
            }, dry_run)
            lead_id = lead['id']

            # 4. Activity log from last_activity_notes (col W)
            activity_notes = sv(row.get('last_activity_notes'))
            if activity_notes:
                db_insert('activities', {
                    'lead_id':      lead_id,
                    'org_id':       org_id,
                    'user_id':      sdr_id or ADMIN_ID,
                    'activity_type':map_activity_type(row.get('last_activity_type')),
                    'outcome':      sv(row.get('last_activity_outcome')),
                    'notes':        activity_notes,
                    'created_at':   parse_iso(row.get('last_activity_date'), fallback=now),
                }, dry_run)

            stats['sdr']['created'] += 1
            print(f"  OK  {org_name}  [{lead_status}]  SDR:{assigned_to_raw or 'unassigned'}")

        except Exception as exc:
            stats['sdr']['errors'] += 1
            print(f"  ERR {org_name}  →  {exc}")

# ── Entry Point ───────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='DaanVeda CRM — Data Migration')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview what would happen without writing to DB')
    args = parser.parse_args()
    dry_run = args.dry_run

    print("=" * 62)
    print(f"  DaanVeda CRM Migration — {'DRY RUN (no writes)' if dry_run else 'LIVE MODE'}")
    print("=" * 62)

    # Verify Excel files exist
    for f in (CONVERTED_FILE, CLOSER_FILE, SDR_FILE):
        if not f.exists():
            print(f"ERROR: File not found: {f}"); sys.exit(1)

    print("\nReading Excel files...")
    df_converted = pd.read_excel(CONVERTED_FILE)
    df_closer    = pd.read_excel(CLOSER_FILE)
    df_sdr       = pd.read_excel(SDR_FILE)
    print(f"  Converted Clients : {len(df_converted):3d} rows")
    print(f"  Closer Pipeline   : {len(df_closer):3d} rows")
    print(f"  SDR Leads         : {len(df_sdr):3d} rows")

    # Load current DB state (skipped in dry-run — we operate on empty maps)
    if dry_run:
        print("\n[DRY RUN] Skipping DB pre-flight load — using empty maps")
        org_by_name = {}; client_orgs = set()
        orgs_with_deal_names = set(); lead_by_org = {}
    else:
        org_by_name, client_orgs, orgs_with_deal_names, lead_by_org = load_db_state()

    # Process in priority order
    converted_orgs = process_converted(df_converted, org_by_name, client_orgs, dry_run)
    closer_orgs    = process_closer(df_closer, org_by_name, orgs_with_deal_names,
                                    lead_by_org, converted_orgs, dry_run)
    process_sdr(df_sdr, org_by_name, converted_orgs, closer_orgs, dry_run)

    # ── Final Report ──────────────────────────────────────────────────────────
    print("\n" + "=" * 62)
    print("  MIGRATION SUMMARY")
    print("=" * 62)
    labels = [('converted', 'Converted Clients'),
              ('closer',    'Closer Pipeline  '),
              ('sdr',       'SDR Leads        ')]
    total_created = total_skipped = total_errors = 0
    for key, label in labels:
        c = stats[key]['created']
        sk = stats[key]['skipped']
        er = stats[key]['errors']
        total_created += c; total_skipped += sk; total_errors += er
        print(f"  {label}   created: {c:3d}   skipped: {sk:3d}   errors: {er:3d}")
    print(f"  {'─'*50}")
    print(f"  {'TOTAL':20s}       created: {total_created:3d}   skipped: {total_skipped:3d}   errors: {total_errors:3d}")

    sdr_db_skipped = stats['sdr_skipped_in_db']
    if sdr_db_skipped:
        print(f"\n  SDR leads skipped (org already in DB lead pool): {len(sdr_db_skipped)}")
        for name in sdr_db_skipped:
            print(f"    • {name}")
        print("\n  These orgs are already in the admin lead pool.")
        print("  Decide later whether to update their status or leave as-is.")

    if dry_run:
        print("\n  ** DRY RUN complete — no data was written to the database **")
    else:
        print("\n  ** Migration complete **")
    print("=" * 62)

if __name__ == '__main__':
    main()
