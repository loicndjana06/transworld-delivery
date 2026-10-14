import { getSupabaseAdminClient, isSupabaseConfigured } from './supabase';
import { clean } from '../app/domain';

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x => x.toString(16).padStart(2, '0')).join('');

export async function hashString(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

export function unpackJson(v: any, fallback: any = {}) {
  if (!v) return fallback;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function checkConfiguration() {
  const configured = isSupabaseConfigured();
  return {
    configured,
    supabaseConfigured: configured,
    mapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    emailConfigured: Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM),
    missingVars: [
      !process.env.NEXT_PUBLIC_SUPABASE_URL ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
      !process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean),
  };
}

// ----------------------------------------------------
// Admin Sessions
// ----------------------------------------------------
export async function createAdminSession(owner: string, secret: string, adminTestPassword: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const hashed = await hashString(secret + adminTestPassword);
  const expires = new Date(Date.now() + 4 * 3600000).toISOString();
  const { error } = await supabase.from('admin_sessions').insert({
    id: hashed,
    owner,
    expires,
  });
  if (error) throw new Error(error.message);
}

export async function validateAdminSession(cookieSecret: string, owner: string, adminTestPassword: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const hashed = await hashString(cookieSecret + adminTestPassword);
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('id')
    .eq('id', hashed)
    .eq('owner', owner)
    .gt('expires', now())
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export async function deleteAdminSession(cookieSecret: string, owner: string, adminTestPassword: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  const hashed = await hashString(cookieSecret + adminTestPassword);
  await supabase.from('admin_sessions').delete().eq('id', hashed).eq('owner', owner);
}

// ----------------------------------------------------
// Tracking (Public & Private)
// ----------------------------------------------------
export async function getTrackingData(ref: string, accessSecret?: string, owner?: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const cleanRef = clean(ref, 60).toUpperCase();
  if (!/^KC-[A-F0-9]{16}$/.test(cleanRef)) {
    throw new Error('Aucun dossier trouvé. Vérifiez votre référence.');
  }

  const { data: s, error: sErr } = await supabase
    .from('shipments')
    .select('*')
    .eq('ref', cleanRef)
    .maybeSingle();

  if (sErr || !s) {
    throw new Error('Aucun dossier trouvé. Vérifiez votre référence.');
  }

  let privateAccess = false;
  if (owner && s.owner === owner) {
    privateAccess = true;
  } else if (accessSecret && s.token_hash) {
    const hashedAccess = await hashString(accessSecret);
    if (s.token_hash === hashedAccess && s.token_expiry > now()) {
      privateAccess = true;
    }
  }

  // Published events ordered by date, created
  const { data: events = [] } = await supabase
    .from('events')
    .select('id, type, place, date, note, planned, published, created, published_at, lat, lng, mode')
    .eq('shipment_id', s.id)
    .eq('published', 1)
    .order('date', { ascending: true })
    .order('created', { ascending: true });

  let extra = {};
  let documents: any[] = [];
  let notices: any[] = [];
  let invoices: any[] = [];
  let corrections: any[] = [];

  if (privateAccess) {
    const { data: sd } = await supabase
      .from('shipment_details')
      .select('data')
      .eq('shipment_id', s.id)
      .maybeSingle();
    extra = unpackJson(sd?.data);

    const { data: docs = [] } = await supabase
      .from('documents')
      .select('id, name, mime, size, created, shared')
      .eq('shipment_id', s.id)
      .eq('shared', 1)
      .order('created', { ascending: false });

    // Join document details
    const docIds = (docs || []).map((d: any) => d.id);
    const detailsMap: Record<string, string> = {};
    if (docIds.length > 0) {
      const { data: dDetails = [] } = await supabase
        .from('document_details')
        .select('document_id, kind')
        .in('document_id', docIds);
      for (const dd of (dDetails || [])) {
        detailsMap[dd.document_id] = dd.kind;
      }
    }

    documents = (docs || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      mime: d.mime,
      size: d.size,
      created: d.created,
      kind: detailsMap[d.id] || 'Document',
    }));

    const { data: notes = [] } = await supabase
      .from('notifications')
      .select('id, title, body, created')
      .eq('shipment_id', s.id)
      .order('created', { ascending: false })
      .limit(30);
    notices = notes || [];

    const { data: invs = [] } = await supabase
      .from('invoices')
      .select('id, number, reason, stage, provider, signer, usd, gnf, gnf_rate, rate_source, status, created')
      .eq('shipment_id', s.id)
      .order('created', { ascending: true });
    invoices = invs || [];

    const invIds = (invs || []).map((i: any) => i.id);
    if (invIds.length > 0) {
      const { data: corrs = [] } = await supabase
        .from('invoice_corrections')
        .select('id, invoice_id, data, created')
        .in('invoice_id', invIds);
      corrections = (corrs || []).map((c: any) => ({
        ...c,
        data: unpackJson(c.data),
      }));
    }
  }

  return {
    notices,
    invoices,
    corrections,
    extra,
    shipment: {
      ref: s.ref,
      origin: s.origin,
      destination: s.destination,
      status: s.status,
      eta: s.eta,
      updated: s.updated,
      ...(privateAccess ? {
        id: s.id,
        item: s.item,
        category: s.category,
        client: s.client,
        container: s.container,
        delivery: s.delivery,
        orderUsd: s.order_usd,
        orderGnf: s.order_gnf,
      } : {}),
    },
    events: events || [],
    documents,
    privateAccess,
  };
}

// ----------------------------------------------------
// Shipments Management (Admin)
// ----------------------------------------------------
export async function listAdminShipments(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { data: shipments = [], error } = await supabase
    .from('shipments')
    .select('id, ref, client, contact, item, category, origin, destination, container, email, delivery, eta, status, created, updated, version')
    .eq('owner', owner)
    .order('updated', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const { data: proofInvoices = [] } = await supabase
    .from('invoices')
    .select('shipment_id')
    .eq('status', 'preuve_recue');

  const counts: Record<string, number> = {};
  for (const inv of (proofInvoices || [])) {
    counts[inv.shipment_id] = (counts[inv.shipment_id] || 0) + 1;
  }

  return (shipments || []).map((s: any) => ({
    ...s,
    proof_count: counts[s.id] || 0,
  }));
}

export async function createAdminShipment(owner: string, b: any) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) throw new Error('Courriel invalide.');
  for (const f of ['client', 'contact', 'item', 'category', 'origin', 'destination', 'purchaseReference', 'firstInvoiceReference']) {
    if (!clean(b[f])) throw new Error('Renseignez les champs obligatoires.');
  }
  if (b.eta && !Number.isFinite(Date.parse(b.eta))) throw new Error('Estimation invalide.');

  const vb = Number(b.vehicleBase);
  const vr = Number(b.vehicleUsdRate);
  const vg = Number(b.vehicleGnfRate);
  const hasPrice = !!(b.vehicleBase || b.vehicleUsdRate || b.vehicleGnfRate);
  if (hasPrice && ![vb, vr, vg].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('Renseignez le prix du véhicule et les deux taux positifs, ou laissez les trois champs vides.');
  }

  const orderUsd = hasPrice ? Math.round(vb * vr * 100) / 100 : null;
  const orderGnf = hasPrice ? Math.round(Number(orderUsd) * vg) : null;
  if (hasPrice && (!Number.isFinite(orderUsd) || !Number.isFinite(orderGnf) || Number(orderUsd) <= 0 || Number(orderGnf) <= 0 || Number(orderUsd) > 1e12 || Number(orderGnf) > 9e15)) {
    throw new Error('Montant converti hors limites.');
  }

  const extra: any = {};
  for (const k of ['vin', 'purchaseReference', 'firstInvoiceReference', 'deliveryCountry', 'deliveryCity', 'deliveryType', 'deliveryAddress', 'deliverySlot', 'destinationModel', 'rateSource', 'rateDate', 'serviceConfirmation', 'segments']) {
    extra[k] = clean(b[k], k === 'segments' ? 3000 : 500);
  }
  if (extra.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(extra.vin)) throw new Error('VIN : 17 caractères, sans I, O ni Q.');
  if (extra.rateDate && !/^\d{4}-\d{2}-\d{2}$/.test(extra.rateDate)) throw new Error('Date des taux invalide.');
  if (extra.deliveryType && !['Port', 'Aéroport', 'Adresse', 'Entrepôt'].includes(extra.deliveryType)) throw new Error('Type de remise invalide.');
  extra.destinationConfirmed = b.destinationConfirmed === true;

  const id = uuid();
  const ref = 'KC-' + token().slice(0, 16).toUpperCase();
  const dateStr = now();
  const secret = token();
  const hashedSecret = await hashString(secret);
  const expiry = new Date(Date.now() + 7 * 86400000).toISOString();

  // Insert shipment
  const { error: sErr } = await supabase.from('shipments').insert({
    id,
    owner,
    ref,
    client: clean(b.client),
    contact: clean(b.contact),
    item: clean(b.item),
    category: clean(b.category),
    origin: clean(b.origin),
    destination: clean(b.destination),
    container: clean(b.container),
    eta: clean(b.eta),
    status: 'Enregistré',
    token_hash: hashedSecret,
    token_expiry: expiry,
    created: dateStr,
    updated: dateStr,
    email: clean(b.email),
    delivery: clean(b.delivery),
    vehicle_xaf: hasPrice ? vb : null,
    order_usd: orderUsd,
    order_gnf: orderGnf,
    version: 0,
  });
  if (sErr) throw new Error(sErr.message);

  // Insert shipment_details
  await supabase.from('shipment_details').insert({
    shipment_id: id,
    data: extra,
    updated: dateStr,
  });

  // Insert audit
  await supabase.from('audit').insert({
    id: uuid(),
    owner,
    shipment_id: id,
    action: 'Dossier créé',
    detail: ref,
    created: dateStr,
  });

  return { id, ref, access: secret, expiry };
}

export async function getShipmentAdminDetail(id: string, owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { data: s, error } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', id)
    .eq('owner', owner)
    .maybeSingle();

  if (error || !s) throw new Error('Accès refusé.');

  const { data: sd } = await supabase.from('shipment_details').select('data').eq('shipment_id', id).maybeSingle();
  const extra = unpackJson(sd?.data);

  const { data: invoices = [] } = await supabase.from('invoices').select('*').eq('shipment_id', id).order('created', { ascending: false });
  const { data: notices = [] } = await supabase.from('notifications').select('*').eq('shipment_id', id).order('created', { ascending: false }).limit(30);
  const { data: events = [] } = await supabase.from('events').select('*').eq('shipment_id', id).order('date', { ascending: false }).order('created', { ascending: false });

  const { data: docs = [] } = await supabase
    .from('documents')
    .select('id, name, mime, size, shared, created')
    .eq('shipment_id', id)
    .order('created', { ascending: false });

  const docIds = (docs || []).map((d: any) => d.id);
  const detailsMap: Record<string, string> = {};
  if (docIds.length > 0) {
    const { data: dDetails = [] } = await supabase
      .from('document_details')
      .select('document_id, kind')
      .in('document_id', docIds);
    for (const dd of (dDetails || [])) {
      detailsMap[dd.document_id] = dd.kind;
    }
  }

  const documents = (docs || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    mime: d.mime,
    size: d.size,
    shared: d.shared,
    created: d.created,
    kind: detailsMap[d.id] || 'Document',
  }));

  const invIds = (invoices || []).map((i: any) => i.id);
  let corrections: any[] = [];
  if (invIds.length > 0) {
    const { data: corrs = [] } = await supabase
      .from('invoice_corrections')
      .select('id, invoice_id, data, created')
      .in('invoice_id', invIds);
    corrections = (corrs || []).map((c: any) => ({
      ...c,
      data: unpackJson(c.data),
    }));
  }

  const { token_hash, token_expiry, ...shipment } = s;
  return {
    extra,
    corrections,
    invoices: invoices || [],
    notices: notices || [],
    shipment,
    events: events || [],
    documents,
  };
}

export async function renewPrivateLink(id: string, owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { data: s } = await supabase.from('shipments').select('ref').eq('id', id).eq('owner', owner).single();
  if (!s) throw new Error('Accès refusé.');

  const secret = token();
  const hashed = await hashString(secret);
  const expiry = new Date(Date.now() + 7 * 86400000).toISOString();

  await supabase
    .from('shipments')
    .update({ token_hash: hashed, token_expiry: expiry })
    .eq('id', id)
    .eq('owner', owner);

  await supabase.from('audit').insert({
    id: uuid(),
    owner,
    shipment_id: id,
    action: 'Lien privé renouvelé',
    detail: 'Ancien lien révoqué',
    created: now(),
  });

  return { ref: s.ref, access: secret, expiry };
}

// ----------------------------------------------------
// Storage (Documents & Payment Receipts)
// ----------------------------------------------------
export async function uploadToStorage(key: string, bytes: Uint8Array, contentType: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { error } = await supabase.storage
    .from('cargo-documents')
    .upload(key, bytes, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error('Erreur de stockage : ' + error.message);
}

export async function getFromStorage(key: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');

  const { data, error } = await supabase.storage
    .from('cargo-documents')
    .download(key);

  if (error || !data) return null;
  const arrayBuffer = await data.arrayBuffer();
  return {
    body: new Uint8Array(arrayBuffer),
    mime: data.type || 'application/octet-stream',
  };
}

export async function deleteFromStorage(key: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;
  await supabase.storage.from('cargo-documents').remove([key]);
}

// ----------------------------------------------------
// Company Settings & Models
// ----------------------------------------------------
export async function getCompanySettings(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data } = await supabase.from('company_settings').select('*').eq('owner', owner).maybeSingle();
  return { data: unpackJson(data?.data), version: data?.version ?? 0 };
}

export async function saveCompanySettings(owner: string, b: any) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const current = await getCompanySettings(owner);
  if (current.version !== 0 && Number(b.version) !== current.version) {
    throw new Error('Configuration modifiée. Actualisez.');
  }
  const d: any = {};
  for (const k of ['name', 'address', 'email', 'phone', 'registration', 'paymentInstructions', 'department']) {
    d[k] = clean(b.data?.[k], k === 'paymentInstructions' ? 2000 : 500);
  }
  if (!d.name) throw new Error('Renseignez le nom réel de l’entreprise.');

  const { error } = await supabase.from('company_settings').upsert({
    owner,
    data: d,
    version: current.version + 1,
  });
  if (error) throw new Error(error.message);

  await supabase.from('audit').insert({
    id: uuid(),
    owner,
    shipment_id: null,
    action: 'Identité entreprise mise à jour',
    detail: d.name,
    created: now(),
  });
  return { ok: true };
}

export async function getAdminModels(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data = [], error } = await supabase
    .from('admin_models')
    .select('*')
    .eq('owner', owner)
    .order('kind')
    .order('name');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ...r, config: unpackJson(r.config) }));
}

export async function saveAdminModel(owner: string, b: any) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  if (!['country', 'service'].includes(b.kind) || !clean(b.name)) throw new Error('Nom et type requis.');

  const { data: old } = b.id
    ? await supabase.from('admin_models').select('*').eq('id', b.id).eq('owner', owner).maybeSingle()
    : { data: null };

  if (old && old.kind !== b.kind) throw new Error('Type de modèle incompatible.');
  if (b.id && !old) throw new Error('Modèle inaccessible.');
  if (old && Number(b.version) !== old.version) throw new Error('Modèle modifié. Actualisez.');

  if (b.action === 'delete') {
    if (!old) throw new Error('Choisissez un modèle existant.');
    await supabase.from('admin_models').delete().eq('id', old.id).eq('owner', owner).eq('version', old.version);
    await supabase.from('audit').insert({
      id: uuid(),
      owner,
      action: 'Modèle supprimé',
      detail: old.name,
      created: now(),
    });
    return { ok: true };
  }

  const raw = b.action === 'duplicate' ? unpackJson(old.config) : b.config || {};
  let cfg: any;
  if (b.kind === 'country') {
    cfg = {
      places: clean(raw.places, 4000),
      stages: clean(raw.stages, 4000),
      formalities: clean(raw.formalities, 4000),
      officialSource: clean(raw.officialSource, 1000),
      tariffs: Array.isArray(raw.tariffs) ? raw.tariffs.slice(0, 60).map((t: any) => ({
        serviceId: clean(t.serviceId),
        label: clean(t.label),
        base_xaf: t.base_xaf === '' || t.base_xaf == null ? null : Number(t.base_xaf),
        reviewed: b.action === 'duplicate' ? false : t.reviewed === true,
      })) : [],
    };
    if (cfg.officialSource && !/^https:\/\//.test(cfg.officialSource)) {
      throw new Error('La source doit être une URL HTTPS officielle vérifiée.');
    }
    if (cfg.tariffs.some((t: any) => t.base_xaf !== null && (!Number.isFinite(t.base_xaf) || t.base_xaf < 0))) {
      throw new Error('Tarif invalide.');
    }
  } else {
    cfg = {
      category: ['Honoraires', 'Droits et taxes', 'Transport', 'Autre'].includes(raw.category) ? raw.category : 'Autre',
      description: clean(raw.description, 2000),
      provider: clean(raw.provider),
      base_xaf: raw.base_xaf === '' || raw.base_xaf == null ? null : Number(raw.base_xaf),
      reviewed: b.action === 'duplicate' ? false : raw.reviewed === true,
    };
    if (cfg.base_xaf !== null && (!Number.isFinite(cfg.base_xaf) || cfg.base_xaf < 0)) {
      throw new Error('Montant invalide.');
    }
  }

  const id = b.action === 'duplicate' || !old ? uuid() : old.id;
  const created = now();

  const { data: duplicate } = await supabase
    .from('admin_models')
    .select('id')
    .eq('owner', owner)
    .eq('kind', b.kind)
    .eq('name', clean(b.name))
    .neq('id', id)
    .maybeSingle();

  if (duplicate) throw new Error('Ce nom existe déjà.');

  if (old && id === old.id) {
    const { error: updErr } = await supabase
      .from('admin_models')
      .update({
        name: clean(b.name),
        config: cfg,
        version: old.version + 1,
        updated: created,
      })
      .eq('id', id)
      .eq('owner', owner)
      .eq('version', old.version);
    if (updErr) throw new Error('Modification concurrente.');
  } else {
    const { error: insErr } = await supabase.from('admin_models').insert({
      id,
      owner,
      kind: b.kind,
      name: clean(b.name),
      config: cfg,
      version: 0,
      created,
      updated: created,
    });
    if (insErr) throw new Error(insErr.message);
  }

  await supabase.from('audit').insert({
    id: uuid(),
    owner,
    action: b.action === 'duplicate' ? 'Modèle dupliqué' : 'Modèle enregistré',
    detail: clean(b.name),
    created,
  });

  return { ok: true, id };
}

// ----------------------------------------------------
// Settings (Google Maps)
// ----------------------------------------------------
export async function getSettings(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data } = await supabase.from('settings').select('maps_key, maps_id').eq('owner', owner).maybeSingle();
  return data || { maps_key: '', maps_id: '' };
}

export async function saveSettings(owner: string, b: any) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  if (b.maps_key && !/^[a-zA-Z0-9_-]{20,100}$/.test(b.maps_key)) {
    throw new Error('Format de clé Google Maps invalide.');
  }
  const { error } = await supabase.from('settings').upsert({
    id: owner,
    owner,
    maps_key: clean(b.maps_key, 100),
    maps_id: clean(b.maps_id, 100),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ----------------------------------------------------
// Requests & Audit
// ----------------------------------------------------
export async function createCustomerRequest(b: any) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  for (const f of ['name', 'contact', 'origin', 'destination', 'category']) {
    if (!clean(b[f])) throw new Error('Renseignez les champs obligatoires.');
  }
  const id = uuid();
  const noteParts = [
    b.note,
    b.deliveryAddress ? 'Remise : ' + clean(b.deliveryAddress) : '',
    b.deliveryCountry ? 'Pays/ville : ' + clean(b.deliveryCountry) : '',
    b.deliverySlot ? 'Créneau : ' + clean(b.deliverySlot) : '',
  ].filter(Boolean);

  const { error } = await supabase.from('requests').insert({
    id,
    owner: 'admin',
    name: clean(b.name),
    contact: clean(b.contact),
    origin: clean(b.origin),
    destination: clean(b.destination),
    category: clean(b.category),
    note: clean(noteParts.join(' • '), 1500),
    created: now(),
  });
  if (error) throw new Error(error.message);
  return { id };
}

export async function getRequests(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data = [], error } = await supabase.from('requests').select('*').eq('owner', owner).order('created', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getAuditLogs(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data = [], error } = await supabase
    .from('audit')
    .select('action, detail, created, shipment_id')
    .eq('owner', owner)
    .order('created', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  // Match ref for shipments
  const shipmentIds = (data || []).map((a: any) => a.shipment_id).filter(Boolean);
  const refMap: Record<string, string> = {};
  if (shipmentIds.length > 0) {
    const { data: sRows = [] } = await supabase.from('shipments').select('id, ref').in('id', shipmentIds);
    for (const s of (sRows || [])) {
      refMap[s.id] = s.ref;
    }
  }

  return (data || []).map((a: any) => ({
    action: a.action,
    detail: a.detail,
    created: a.created,
    ref: refMap[a.shipment_id] || '',
  }));
}

export async function getExportData(owner: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase non configuré');
  const { data: shipments = [] } = await supabase.from('shipments').select('*').eq('owner', owner);
  const sIds = (shipments || []).map((s: any) => s.id);

  let events: any[] = [];
  let invoices: any[] = [];
  if (sIds.length > 0) {
    const { data: eRows = [] } = await supabase.from('events').select('*').in('shipment_id', sIds);
    events = eRows || [];
    const { data: iRows = [] } = await supabase.from('invoices').select('*').in('shipment_id', sIds);
    invoices = iRows || [];
  }

  return {
    version: 1,
    shipments: (shipments || []).map((s: any) => {
      const { token_hash, token_expiry, ...rest } = s;
      return rest;
    }),
    events,
    invoices,
  };
}

